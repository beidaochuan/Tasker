// @vitest-environment node

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { AuthConfig, ServerConfig } from '../config.js'

process.env.TASKER_DB_PATH = ':memory:'

const { createApp } = await import('../app.js')
const { SessionStore } = await import('../auth.js')

const TEST_USERNAME = 'test-admin'
const TEST_PASSWORD = 'test-password-123'
const servers: Server[] = []

interface RunningApp {
  baseUrl: string
  server: Server
}

interface LoginResult {
  response: Response
  body: Record<string, unknown>
  cookie: string | null
}

function createTestConfig(
  authOverrides: Partial<AuthConfig> = {},
  corsOrigins: readonly string[] = []
): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    corsOrigins,
    auth: {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      maxSessions: 8,
      cookieSecure: false,
      loginWindowMs: 15 * 60 * 1000,
      maxLoginAttempts: 5,
      ...authOverrides,
    },
  }
}

async function startApp(config = createTestConfig(), now?: () => number): Promise<RunningApp> {
  const server = createServer(createApp({ config, now }))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return { baseUrl: `http://127.0.0.1:${address.port}`, server }
}

async function request(app: RunningApp, path: string, init?: RequestInit) {
  const response = await fetch(`${app.baseUrl}${path}`, init)
  const body = response.status === 204 ? null : await response.json()
  return { response, body }
}

async function loginRequest(
  app: RunningApp,
  credentials: { username: string; password: string } = {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
  },
  headers?: HeadersInit
): Promise<LoginResult> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Content-Type', 'application/json')
  const { response, body } = await request(app, '/api/auth/login', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(credentials),
  })
  const setCookie = response.headers.get('set-cookie')
  return {
    response,
    body: body as Record<string, unknown>,
    cookie: setCookie?.split(';', 1)[0] ?? null,
  }
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

describe('SessionStore', () => {
  it('raw tokenではなくSHA-256 hashをMap keyにし、アクセス時に期限切れを掃除する', () => {
    // 2024-01-15 23:59:59.000（ローカル時刻）
    let now = new Date(2024, 0, 15, 23, 59, 59, 0).getTime()
    const store = new SessionStore(2, () => now)

    const session = store.create()
    const internalSessions = (
      store as unknown as { sessions: Map<string, { csrfToken: string; expiresAt: number }> }
    ).sessions
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(internalSessions.has(session.token)).toBe(false)
    expect([...internalSessions.keys()]).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)])
    expect(session.expiresAt).toBe(new Date(2024, 0, 16, 0, 0, 0, 0).getTime())

    // 深夜0:00を過ぎた時点でexpire
    now = new Date(2024, 0, 16, 0, 0, 0, 0).getTime()
    expect(store.size).toBe(0)
  })

  it('ちょうど深夜0:00にログインした場合は即時失効せず翌日深夜まで有効', () => {
    const midnight = new Date(2024, 0, 16, 0, 0, 0, 0).getTime()
    const store = new SessionStore(2, () => midnight)
    const session = store.create()
    expect(session.expiresAt).toBe(new Date(2024, 0, 17, 0, 0, 0, 0).getTime())
  })

  it.each([
    [new Date(2024, 0, 31, 23, 30, 0, 0), new Date(2024, 1, 1, 0, 0, 0, 0)], // 1月末→2月
    [new Date(2023, 11, 31, 23, 30, 0, 0), new Date(2024, 0, 1, 0, 0, 0, 0)], // 年末→年始
    [new Date(2024, 1, 29, 12, 0, 0, 0), new Date(2024, 2, 1, 0, 0, 0, 0)], // 閏年2/29→3/1
  ])(
    '月末・年末・閏年をまたいでも次のローカル深夜0:00を正しく計算する',
    (loginAt, expectedMidnight) => {
      const store = new SessionStore(2, () => loginAt.getTime())
      const session = store.create()
      expect(session.expiresAt).toBe(expectedMidnight.getTime())
    }
  )
})

describe('authentication API', () => {
  it('未認証状態を200で返し、認証レスポンスをcacheしない', async () => {
    const app = await startApp()

    const { response, body } = await request(app, '/api/auth/session')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({ isAuthenticated: false })
  })

  it('loginでopaque session CookieとCSRF tokenを発行し、sessionから復元する', async () => {
    // 2024-01-15 23:00:00.000（ローカル時刻）にログイン→次の深夜0:00まで1時間
    const loginAt = new Date(2024, 0, 15, 23, 0, 0, 0).getTime()
    const midnight = new Date(2024, 0, 16, 0, 0, 0, 0).getTime()
    let now = loginAt
    const app = await startApp(createTestConfig(), () => now)

    const login = await loginRequest(app)

    expect(login.response.status).toBe(200)
    expect(login.response.headers.get('cache-control')).toBe('no-store')
    expect(login.response.headers.get('x-powered-by')).toBeNull()
    expect(login.body).toMatchObject({
      isAuthenticated: true,
      expiresAt: midnight,
      expiresInMs: midnight - loginAt,
    })
    expect(login.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(login.body)).not.toContain(TEST_PASSWORD)
    expect(login.cookie).toMatch(/^tasker_session=[A-Za-z0-9_-]{43}$/)

    const setCookie = login.response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`Max-Age=${Math.ceil((midnight - loginAt) / 1000)}`)
    expect(setCookie).toContain('Path=/api')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).not.toContain('Domain=')
    expect(setCookie).not.toContain('Secure')

    now += 1
    const restored = await request(app, '/api/auth/session', {
      headers: { Cookie: login.cookie! },
    })
    expect(restored.body).toEqual({
      ...login.body,
      expiresInMs: midnight - loginAt - 1,
    })
  })

  it('明示設定時だけSecure Cookieを発行する', async () => {
    const app = await startApp(createTestConfig({ cookieSecure: true }))

    const login = await loginRequest(app)

    expect(login.response.status).toBe(200)
    expect(login.response.headers.get('set-cookie')).toContain('Secure')
  })

  it('不正な資格情報を同じ401で拒否する', async () => {
    const app = await startApp()

    const wrongUsername = await loginRequest(app, {
      username: 'someone-else',
      password: TEST_PASSWORD,
    })
    const wrongPassword = await loginRequest(app, {
      username: TEST_USERNAME,
      password: 'wrong-password',
    })

    expect(wrongUsername.response.status).toBe(401)
    expect(wrongPassword.response.status).toBe(401)
    expect(wrongUsername.body).toEqual({ error: 'UNAUTHORIZED' })
    expect(wrongPassword.body).toEqual({ error: 'UNAUTHORIZED' })
    expect(wrongUsername.cookie).toBeNull()
    expect(wrongPassword.cookie).toBeNull()
  })

  it('loginをJSONかつ小容量のbodyに限定する', async () => {
    const app = await startApp()

    const form = await request(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=test-admin&password=test-password-123',
    })
    const malformed = await request(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    const oversized = await request(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x'.repeat(10_000), password: TEST_PASSWORD }),
    })

    expect(form.response.status).toBe(415)
    expect(malformed.response.status).toBe(400)
    expect(oversized.response.status).toBe(413)
  })

  it('設定で許可する最大長のpasswordでもloginできる', async () => {
    const password = '\u0001'.repeat(1_024)
    const app = await startApp(createTestConfig({ password }))

    const login = await loginRequest(app, { username: TEST_USERNAME, password })

    expect(login.response.status).toBe(200)
    expect(login.body).toMatchObject({ isAuthenticated: true })
  })

  it('IP単位の失敗回数を制限し、時間窓の終了後に再試行を許可する', async () => {
    let now = 1_000
    const app = await startApp(
      createTestConfig({ maxLoginAttempts: 5, loginWindowMs: 15 * 60 * 1000 }),
      () => now
    )

    for (let index = 0; index < 5; index += 1) {
      const failed = await loginRequest(app, {
        username: TEST_USERNAME,
        password: 'wrong-password',
      })
      expect(failed.response.status).toBe(401)
    }

    const limited = await loginRequest(app)
    expect(limited.response.status).toBe(429)
    expect(limited.response.headers.get('retry-after')).toBe('900')
    expect(limited.body).toEqual({ error: 'TOO_MANY_LOGIN_ATTEMPTS' })

    now += 15 * 60 * 1000
    const afterWindow = await loginRequest(app, {
      username: TEST_USERNAME,
      password: 'wrong-password',
    })
    expect(afterWindow.response.status).toBe(401)
  })

  it('login成功時に既存sessionをrotateする', async () => {
    const app = await startApp()
    const first = await loginRequest(app)
    const second = await loginRequest(app, undefined, { Cookie: first.cookie! })

    expect(second.response.status).toBe(200)
    expect(second.cookie).not.toBe(first.cookie)
    expect(
      (await request(app, '/api/auth/session', { headers: { Cookie: first.cookie! } })).body
    ).toEqual({ isAuthenticated: false })
    expect(
      (await request(app, '/api/auth/session', { headers: { Cookie: second.cookie! } })).body
    ).toMatchObject({ isAuthenticated: true })
  })

  it('session上限を超えたとき最古sessionを失効する', async () => {
    const app = await startApp(createTestConfig({ maxSessions: 2 }))
    const first = await loginRequest(app)
    const second = await loginRequest(app)
    const third = await loginRequest(app)

    expect(
      (await request(app, '/api/auth/session', { headers: { Cookie: first.cookie! } })).body
    ).toEqual({ isAuthenticated: false })
    expect(
      (await request(app, '/api/auth/session', { headers: { Cookie: second.cookie! } })).body
    ).toMatchObject({ isAuthenticated: true })
    expect(
      (await request(app, '/api/auth/session', { headers: { Cookie: third.cookie! } })).body
    ).toMatchObject({ isAuthenticated: true })
  })

  it('ローカル深夜0:00を越えるとsessionを失効し、サーバー再起動でも失効する', async () => {
    // 2024-01-15 23:59:59.900（ローカル時刻）にログイン
    const loginAt = new Date(2024, 0, 15, 23, 59, 59, 900).getTime()
    const midnight = new Date(2024, 0, 16, 0, 0, 0, 0).getTime()
    let now = loginAt
    const config = createTestConfig()
    const firstApp = await startApp(config, () => now)
    const login = await loginRequest(firstApp)
    expect(login.body).toMatchObject({ expiresAt: midnight })

    // 深夜0:00の直前(1ms前)はまだ有効
    now = midnight - 1
    const stillValid = await request(firstApp, '/api/auth/session', {
      headers: { Cookie: login.cookie! },
    })
    expect(stillValid.body).toMatchObject({ isAuthenticated: true })

    // 深夜0:00ちょうどで失効
    now = midnight
    const expired = await request(firstApp, '/api/auth/session', {
      headers: { Cookie: login.cookie! },
    })
    expect(expired.body).toEqual({ isAuthenticated: false })
    expect(expired.response.headers.get('set-cookie')).toContain('tasker_session=;')

    // サーバー(Windowsサービス)再起動でメモリ内sessionが全て失われることは変更なし
    const restartedApp = await startApp(config, () => loginAt)
    const afterRestart = await request(restartedApp, '/api/auth/session', {
      headers: { Cookie: login.cookie! },
    })
    expect(afterRestart.body).toEqual({ isAuthenticated: false })
  })

  it('logoutをCSRFで保護し、成功時にsessionとCookieを失効する', async () => {
    const app = await startApp()
    const login = await loginRequest(app)

    const missingCsrf = await request(app, '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: login.cookie! },
    })
    expect(missingCsrf.response.status).toBe(403)

    const logout = await request(app, '/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: login.cookie!,
        'X-CSRF-Token': String(login.body.csrfToken),
      },
    })
    expect(logout.response.status).toBe(204)
    expect(logout.response.headers.get('cache-control')).toBe('no-store')
    expect(logout.response.headers.get('set-cookie')).toContain('tasker_session=;')

    const restored = await request(app, '/api/auth/session', {
      headers: { Cookie: login.cookie! },
    })
    expect(restored.body).toEqual({ isAuthenticated: false })

    const unauthenticatedLogout = await request(app, '/api/auth/logout', { method: 'POST' })
    expect(unauthenticatedLogout.response.status).toBe(401)
  })

  it('logout後は旧Cookieと旧CSRF tokenでもプロジェクトを作成できない', async () => {
    const app = await startApp()
    const before = await request(app, '/api/projects')
    const login = await loginRequest(app)

    const logout = await request(app, '/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: login.cookie!,
        'X-CSRF-Token': String(login.body.csrfToken),
      },
    })
    expect(logout.response.status).toBe(204)

    const create = await request(app, '/api/projects', {
      method: 'POST',
      headers: {
        Cookie: login.cookie!,
        'Content-Type': 'application/json',
        'X-CSRF-Token': String(login.body.csrfToken),
      },
      body: JSON.stringify({ name: '作成させない' }),
    })

    expect(create.response.status).toBe(401)
    expect(create.body).toEqual({ error: 'UNAUTHORIZED' })
    expect((await request(app, '/api/projects')).body).toEqual(before.body)
  })
})

describe('authentication middleware', () => {
  const publicReads = [
    '/api/projects',
    '/api/projects/missing-project',
    '/api/topics',
    '/api/topics/missing-topic',
    '/api/tasks',
    '/api/tasks/missing-task',
    '/api/subtasks',
    '/api/tags',
    '/api/completions',
  ] as const

  const protectedMutations = [
    ['POST', '/api/projects'],
    ['PATCH', '/api/projects/project-1'],
    ['DELETE', '/api/projects/project-1'],
    ['POST', '/api/topics'],
    ['PATCH', '/api/topics/topic-1'],
    ['DELETE', '/api/topics/topic-1'],
    ['POST', '/api/tasks'],
    ['POST', '/api/tasks/task-1/complete-recurring'],
    ['PATCH', '/api/tasks/gantt-order'],
    ['PATCH', '/api/tasks/task-1'],
    ['DELETE', '/api/tasks/task-1'],
    ['POST', '/api/subtasks'],
    ['PATCH', '/api/subtasks/order'],
    ['PATCH', '/api/subtasks/subtask-1'],
    ['DELETE', '/api/subtasks/subtask-1'],
    ['POST', '/api/tags'],
    ['DELETE', '/api/tags/tag-1'],
    ['POST', '/api/completions'],
    ['POST', '/api/import'],
  ] as const

  it('全データmutationをJSON解析より先に401で拒否する', async () => {
    const app = await startApp()

    for (const [method, path] of protectedMutations) {
      const { response, body } = await request(app, path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
      expect(response.status, `${method} ${path}`).toBe(401)
      expect(body, `${method} ${path}`).toEqual({ error: 'UNAUTHORIZED' })
    }
  })

  it('GETを公開したまま、認証済みmutationには正しいCSRF tokenを要求する', async () => {
    const app = await startApp()
    for (const path of publicReads) {
      const publicRead = await request(app, path)
      expect(publicRead.response.status, path).not.toBe(401)
    }

    const login = await loginRequest(app)
    const missing = await request(app, '/api/projects', {
      method: 'POST',
      headers: { Cookie: login.cookie!, 'Content-Type': 'application/json' },
      body: '{',
    })
    const invalid = await request(app, '/api/projects', {
      method: 'POST',
      headers: {
        Cookie: login.cookie!,
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'invalid',
      },
      body: '{',
    })
    const valid = await request(app, '/api/projects', {
      method: 'POST',
      headers: {
        Cookie: login.cookie!,
        'Content-Type': 'application/json',
        'X-CSRF-Token': String(login.body.csrfToken),
      },
      body: '{',
    })

    expect(missing.response.status).toBe(403)
    expect(invalid.response.status).toBe(403)
    expect(valid.response.status).toBe(400)
  })
})

describe('CORS', () => {
  it('別portのlocalhost originを既定では許可しない', async () => {
    const app = await startApp()

    const denied = await request(app, '/api/auth/session', {
      headers: { Origin: 'http://127.0.0.1:3208' },
    })

    expect(denied.response.status).toBe(403)
    expect(denied.body).toEqual({ error: 'CORS_ORIGIN_DENIED' })
  })

  it('same hostと明示allowlist originへcredentialed responseを返す', async () => {
    const configuredOrigin = 'https://client.example.test'
    const app = await startApp(createTestConfig({}, [configuredOrigin]))

    const sameHost = await request(app, '/api/auth/session', {
      headers: { Origin: app.baseUrl },
    })
    expect(sameHost.response.status).toBe(200)
    expect(sameHost.response.headers.get('access-control-allow-origin')).toBe(app.baseUrl)
    expect(sameHost.response.headers.get('access-control-allow-credentials')).toBe('true')

    const configured = await request(app, '/api/auth/session', {
      headers: { Origin: configuredOrigin },
    })
    expect(configured.response.status).toBe(200)
    expect(configured.response.headers.get('access-control-allow-origin')).toBe(configuredOrigin)
    expect(configured.response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('Hostが一致するHTTPS reverse proxy originをsame-originとして扱う', async () => {
    const app = await startApp()
    const httpsOrigin = app.baseUrl.replace('http://', 'https://')

    const response = await request(app, '/api/auth/session', {
      headers: { Origin: httpsOrigin },
    })

    expect(response.response.status).toBe(200)
    expect(response.response.headers.get('access-control-allow-origin')).toBe(httpsOrigin)
  })

  it('未許可originをroute実行前に403で拒否する', async () => {
    const app = await startApp()

    const denied = await request(app, '/api/auth/session', {
      headers: { Origin: 'https://evil.example.test' },
    })

    expect(denied.response.status).toBe(403)
    expect(denied.body).toEqual({ error: 'CORS_ORIGIN_DENIED' })
    expect(denied.response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('許可originのcredentialed preflightへ必要なheaderを返す', async () => {
    const origin = 'http://localhost:3208'
    const app = await startApp(createTestConfig({}, [origin]))

    const response = await fetch(`${app.baseUrl}/api/projects`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-csrf-token',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type,X-CSRF-Token')
  })
})
