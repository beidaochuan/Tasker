import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import express, { Router, type CookieOptions, type Request, type RequestHandler } from 'express'
import { MAX_ADMIN_PASSWORD_LENGTH, MAX_ADMIN_USERNAME_LENGTH, type AuthConfig } from './config.js'

export const SESSION_COOKIE_NAME = 'tasker_session'
export const CSRF_HEADER_NAME = 'X-CSRF-Token'

const LOGIN_BODY_LIMIT = '8kb'
const MAX_TRACKED_LOGIN_IPS = 1_024
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

interface SessionRecord {
  csrfToken: string
  expiresAt: number
}

interface CreatedSession extends SessionRecord {
  token: string
}

interface LoginAttempt {
  failures: number
  resetAt: number
}

interface AuthenticatedSession {
  token: string
  record: SessionRecord
}

type Clock = () => number

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxSessions: number,
    private readonly now: Clock = Date.now
  ) {}

  create(): CreatedSession {
    const now = this.now()
    this.cleanupExpired(now)
    this.evictToCapacity()

    let token: string
    let tokenHash: string
    do {
      token = randomToken()
      tokenHash = hashToken(token)
    } while (this.sessions.has(tokenHash))

    const record = {
      csrfToken: randomToken(),
      expiresAt: now + this.ttlMs,
    }
    this.sessions.set(tokenHash, record)
    return { token, ...record }
  }

  get(token: string): SessionRecord | undefined {
    const now = this.now()
    this.cleanupExpired(now)
    if (!SESSION_TOKEN_PATTERN.test(token)) return undefined
    return this.sessions.get(hashToken(token))
  }

  destroy(token: string): void {
    this.cleanupExpired(this.now())
    if (!SESSION_TOKEN_PATTERN.test(token)) return
    this.sessions.delete(hashToken(token))
  }

  get size(): number {
    this.cleanupExpired(this.now())
    return this.sessions.size
  }

  private cleanupExpired(now: number): void {
    for (const [tokenHash, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(tokenHash)
    }
  }

  private evictToCapacity(): void {
    while (this.sessions.size >= this.maxSessions) {
      const oldestTokenHash = this.sessions.keys().next().value as string | undefined
      if (!oldestTokenHash) return
      this.sessions.delete(oldestTokenHash)
    }
  }
}

class LoginAttemptTracker {
  private readonly attempts = new Map<string, LoginAttempt>()

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly now: Clock
  ) {}

  retryAfterSeconds(key: string): number | null {
    const now = this.now()
    this.cleanupExpired(now)
    const attempt = this.attempts.get(key)
    if (!attempt || attempt.failures < this.maxAttempts) return null
    return Math.max(1, Math.ceil((attempt.resetAt - now) / 1000))
  }

  recordFailure(key: string): void {
    const now = this.now()
    this.cleanupExpired(now)
    const current = this.attempts.get(key)
    if (current) {
      current.failures += 1
      return
    }

    if (this.attempts.size >= MAX_TRACKED_LOGIN_IPS) {
      const oldestKey = this.attempts.keys().next().value as string | undefined
      if (oldestKey) this.attempts.delete(oldestKey)
    }
    this.attempts.set(key, { failures: 1, resetAt: now + this.windowMs })
  }

  reset(key: string): void {
    this.cleanupExpired(this.now())
    this.attempts.delete(key)
  }

  private cleanupExpired(now: number): void {
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetAt <= now) this.attempts.delete(key)
    }
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    const value = part.slice(separator + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

function loginBody(value: unknown): { username: string; password: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (
    Object.keys(body).some((key) => key !== 'username' && key !== 'password') ||
    typeof body.username !== 'string' ||
    typeof body.password !== 'string' ||
    body.username.length > MAX_ADMIN_USERNAME_LENGTH ||
    body.password.length > MAX_ADMIN_PASSWORD_LENGTH
  ) {
    return null
  }
  return { username: body.username.trim(), password: body.password }
}

export interface AuthFeature {
  router: Router
  protectUnsafeRequests: RequestHandler
  sessionStore: SessionStore
}

export function createAuthFeature(config: AuthConfig, now: Clock = Date.now): AuthFeature {
  const router = Router()
  const sessionStore = new SessionStore(config.sessionTtlMs, config.maxSessions, now)
  const loginAttempts = new LoginAttemptTracker(config.maxLoginAttempts, config.loginWindowMs, now)
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/api',
  }

  function clearSessionCookie(res: express.Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions)
  }

  function authenticatedSession(req: Request): AuthenticatedSession | null {
    const token = readCookie(req, SESSION_COOKIE_NAME)
    if (!token) return null
    const record = sessionStore.get(token)
    return record ? { token, record } : null
  }

  function expiresInMs(session: SessionRecord): number {
    return Math.max(0, Math.ceil(session.expiresAt - now()))
  }

  function requireSessionAndCsrf(req: Request, res: express.Response): AuthenticatedSession | null {
    const session = authenticatedSession(req)
    if (!session) {
      if (readCookie(req, SESSION_COOKIE_NAME)) clearSessionCookie(res)
      res.status(401).json({ error: 'UNAUTHORIZED' })
      return null
    }

    const csrfToken = req.get(CSRF_HEADER_NAME)
    if (!csrfToken || !constantTimeEqual(csrfToken, session.record.csrfToken)) {
      res.status(403).json({ error: 'CSRF_INVALID' })
      return null
    }
    return session
  }

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/session', (req, res) => {
    const session = authenticatedSession(req)
    if (!session) {
      if (readCookie(req, SESSION_COOKIE_NAME)) clearSessionCookie(res)
      res.json({ isAuthenticated: false })
      return
    }

    res.json({
      isAuthenticated: true,
      csrfToken: session.record.csrfToken,
      expiresAt: session.record.expiresAt,
      expiresInMs: expiresInMs(session.record),
    })
  })

  router.post(
    '/login',
    (req, res, next) => {
      const retryAfter = loginAttempts.retryAfterSeconds(req.ip || req.socket.remoteAddress || '')
      if (retryAfter === null) {
        next()
        return
      }
      res.set('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'TOO_MANY_LOGIN_ATTEMPTS' })
    },
    (req, res, next) => {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' })
        return
      }
      next()
    },
    express.json({ limit: LOGIN_BODY_LIMIT }),
    (req, res) => {
      const input = loginBody(req.body)
      if (!input) {
        res.status(400).json({ error: 'VALIDATION_ERROR' })
        return
      }

      const usernameMatches = constantTimeEqual(input.username, config.username)
      const passwordMatches = constantTimeEqual(input.password, config.password)
      const clientKey = req.ip || req.socket.remoteAddress || ''
      if (!usernameMatches || !passwordMatches) {
        loginAttempts.recordFailure(clientKey)
        res.status(401).json({ error: 'UNAUTHORIZED' })
        return
      }

      loginAttempts.reset(clientKey)
      const previousToken = readCookie(req, SESSION_COOKIE_NAME)
      if (previousToken) sessionStore.destroy(previousToken)
      const session = sessionStore.create()
      res.cookie(SESSION_COOKIE_NAME, session.token, {
        ...cookieOptions,
        maxAge: config.sessionTtlMs,
      })
      res.json({
        isAuthenticated: true,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        expiresInMs: expiresInMs(session),
      })
    }
  )

  router.post('/logout', (req, res) => {
    const session = requireSessionAndCsrf(req, res)
    if (!session) return
    sessionStore.destroy(session.token)
    clearSessionCookie(res)
    res.status(204).send()
  })

  const protectUnsafeRequests: RequestHandler = (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next()
      return
    }
    if (!requireSessionAndCsrf(req, res)) return
    next()
  }

  return { router, protectUnsafeRequests, sessionStore }
}
