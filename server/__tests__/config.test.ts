// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { DEFAULT_LOGIN_WINDOW_MS, DEFAULT_MAX_LOGIN_ATTEMPTS, loadServerConfig } from '../config.js'

const REQUIRED_ENV = {
  TASKER_ADMIN_USERNAME: 'admin',
  TASKER_ADMIN_PASSWORD: 'password-for-tests',
}

describe('server config', () => {
  it('安全な待受・Cookie・認証制限を既定値にする', () => {
    const config = loadServerConfig(REQUIRED_ENV)

    expect(config.port).toBe(3208)
    expect(config.host).toBe('127.0.0.1')
    expect(config.corsOrigins).toEqual([])
    expect(config.auth).toMatchObject({
      username: 'admin',
      password: 'password-for-tests',
      sessionTtlMs: 8 * 60 * 60 * 1000,
      maxSessions: 8,
      cookieSecure: false,
      loginWindowMs: DEFAULT_LOGIN_WINDOW_MS,
      maxLoginAttempts: DEFAULT_MAX_LOGIN_ATTEMPTS,
    })
  })

  it('明示した待受・Cookie・期限・ログイン制限・CORS originを読み込む', () => {
    const config = loadServerConfig({
      ...REQUIRED_ENV,
      PORT: '8080',
      TASKER_HOST: '0.0.0.0',
      TASKER_COOKIE_SECURE: 'true',
      TASKER_SESSION_TTL_MINUTES: '60',
      TASKER_LOGIN_MAX_ATTEMPTS: '3',
      TASKER_LOGIN_WINDOW_MINUTES: '10',
      CORS_ORIGIN: 'https://tasker.example.test/, http://192.0.2.10:8080',
    })

    expect(config.port).toBe(8080)
    expect(config.host).toBe('0.0.0.0')
    expect(config.auth).toMatchObject({
      cookieSecure: true,
      sessionTtlMs: 60 * 60 * 1000,
      maxSessions: 8,
      loginWindowMs: 10 * 60 * 1000,
      maxLoginAttempts: 3,
    })
    expect(config.corsOrigins).toEqual(['https://tasker.example.test', 'http://192.0.2.10:8080'])
  })

  it.each([
    [{ TASKER_ADMIN_PASSWORD: 'password-for-tests' }, 'TASKER_ADMIN_USERNAME'],
    [{ TASKER_ADMIN_USERNAME: 'admin' }, 'TASKER_ADMIN_PASSWORD'],
    [{ TASKER_ADMIN_USERNAME: 'admin', TASKER_ADMIN_PASSWORD: 'short' }, '12文字以上'],
    [{ TASKER_ADMIN_USERNAME: 'admin', TASKER_ADMIN_PASSWORD: 'x'.repeat(1_025) }, '1024文字以下'],
  ])('必須の管理者資格情報が安全でなければ起動設定を拒否する', (env, message) => {
    expect(() => loadServerConfig(env)).toThrow(message)
  })

  it.each([
    [{ ...REQUIRED_ENV, TASKER_COOKIE_SECURE: 'yes' }, 'TASKER_COOKIE_SECURE'],
    [{ ...REQUIRED_ENV, TASKER_SESSION_TTL_MINUTES: '0' }, 'TASKER_SESSION_TTL_MINUTES'],
    [{ ...REQUIRED_ENV, TASKER_LOGIN_MAX_ATTEMPTS: '0' }, 'TASKER_LOGIN_MAX_ATTEMPTS'],
    [{ ...REQUIRED_ENV, TASKER_LOGIN_WINDOW_MINUTES: '1.5' }, 'TASKER_LOGIN_WINDOW_MINUTES'],
    [{ ...REQUIRED_ENV, PORT: '70000' }, 'PORT'],
    [{ ...REQUIRED_ENV, CORS_ORIGIN: '*' }, 'CORS_ORIGIN'],
    [{ ...REQUIRED_ENV, CORS_ORIGIN: 'https://example.test/path' }, 'オリジン'],
  ])('不正な環境変数をfail closedで拒否する', (env, message) => {
    expect(() => loadServerConfig(env)).toThrow(message)
  })
})
