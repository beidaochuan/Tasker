const DEFAULT_PORT = 3208
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_SESSION_TTL_MINUTES = 480
const DEFAULT_MAX_SESSIONS = 8
const DEFAULT_LOGIN_WINDOW_MINUTES = 15

export const MAX_ADMIN_USERNAME_LENGTH = 256
export const MAX_ADMIN_PASSWORD_LENGTH = 1_024
export const DEFAULT_LOGIN_WINDOW_MS = DEFAULT_LOGIN_WINDOW_MINUTES * 60 * 1000
export const DEFAULT_MAX_LOGIN_ATTEMPTS = 5

export interface AuthConfig {
  username: string
  password: string
  sessionTtlMs: number
  maxSessions: number
  cookieSecure: boolean
  loginWindowMs: number
  maxLoginAttempts: number
}

export interface ServerConfig {
  port: number
  host: string
  corsOrigins: readonly string[]
  auth: AuthConfig
}

type Environment = Readonly<Record<string, string | undefined>>

function requiredValue(env: Environment, name: string): string {
  const value = env[name]
  if (value === undefined || value === '') {
    throw new Error(`${name} を設定してください`)
  }
  return value
}

function parseInteger(
  env: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} は ${minimum} 以上 ${maximum} 以下の整数で指定してください`)
  }
  return value
}

function parseBoolean(env: Environment, name: string, fallback: boolean): boolean {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new Error(`${name} は true または false で指定してください`)
}

function normalizeOrigin(value: string): string {
  if (value === '*') throw new Error('CORS_ORIGIN に * は指定できません')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`CORS_ORIGIN の値が不正です: ${value}`)
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(`CORS_ORIGIN には http(s) のオリジンだけを指定してください: ${value}`)
  }

  return url.origin
}

function loadCorsOrigins(env: Environment): readonly string[] {
  const origins = new Set<string>()
  const configured = env.CORS_ORIGIN
  if (!configured) return [...origins]

  for (const value of configured.split(',')) {
    const trimmed = value.trim()
    if (trimmed === '') continue
    origins.add(normalizeOrigin(trimmed))
  }
  return [...origins]
}

export function loadServerConfig(env: Environment = process.env): ServerConfig {
  const username = requiredValue(env, 'TASKER_ADMIN_USERNAME').trim()
  if (username === '') throw new Error('TASKER_ADMIN_USERNAME を設定してください')
  if (username.length > MAX_ADMIN_USERNAME_LENGTH) {
    throw new Error(
      `TASKER_ADMIN_USERNAME は${MAX_ADMIN_USERNAME_LENGTH}文字以下で設定してください`
    )
  }

  const password = requiredValue(env, 'TASKER_ADMIN_PASSWORD')
  if (password.length < 12) {
    throw new Error('TASKER_ADMIN_PASSWORD は12文字以上で設定してください')
  }
  if (password.length > MAX_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `TASKER_ADMIN_PASSWORD は${MAX_ADMIN_PASSWORD_LENGTH}文字以下で設定してください`
    )
  }

  const sessionTtlMinutes = parseInteger(
    env,
    'TASKER_SESSION_TTL_MINUTES',
    DEFAULT_SESSION_TTL_MINUTES,
    1,
    10_080
  )

  return {
    port: parseInteger(env, 'PORT', DEFAULT_PORT, 1, 65_535),
    host: env.TASKER_HOST?.trim() || DEFAULT_HOST,
    corsOrigins: loadCorsOrigins(env),
    auth: {
      username,
      password,
      sessionTtlMs: sessionTtlMinutes * 60 * 1000,
      maxSessions: DEFAULT_MAX_SESSIONS,
      cookieSecure: parseBoolean(env, 'TASKER_COOKIE_SECURE', false),
      loginWindowMs:
        parseInteger(env, 'TASKER_LOGIN_WINDOW_MINUTES', DEFAULT_LOGIN_WINDOW_MINUTES, 1, 1_440) *
        60 *
        1000,
      maxLoginAttempts: parseInteger(
        env,
        'TASKER_LOGIN_MAX_ATTEMPTS',
        DEFAULT_MAX_LOGIN_ATTEMPTS,
        1,
        100
      ),
    },
  }
}
