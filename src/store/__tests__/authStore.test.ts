import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../authStore'

const authApiMock = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  loginWithCredentials: vi.fn(),
  logoutSession: vi.fn(),
}))

vi.mock('@/auth/authApi', () => authApiMock)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('authStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authApiMock.fetchAuthSession.mockReset()
    authApiMock.loginWithCredentials.mockReset()
    authApiMock.logoutSession.mockReset()
    window.localStorage.clear()
    useAuthStore.setState({
      isAuthenticated: false,
      isSessionChecked: false,
      isRestoring: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: false,
    })
  })

  afterEach(() => {
    useAuthStore.getState().handleUnauthorized()
    vi.useRealTimers()
  })

  it('サーバーセッションから認証状態を復元し、旧localStorageフラグを削除する', async () => {
    const expiresAt = Date.now() + 60_000
    window.localStorage.setItem('tasker-authenticated', 'true')
    authApiMock.fetchAuthSession.mockResolvedValue({
      isAuthenticated: true,
      csrfToken: 'csrf-restored',
      expiresAt,
      expiresInMs: 60_000,
    })

    await useAuthStore.getState().restoreSession()

    expect(window.localStorage.getItem('tasker-authenticated')).toBeNull()
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: 'csrf-restored',
      expiresAt,
    })
  })

  it('StrictModeから同時に復元されても状態APIを一度だけ呼ぶ', async () => {
    const session = deferred<{
      isAuthenticated: false
      csrfToken: null
      expiresAt: null
      expiresInMs: null
    }>()
    authApiMock.fetchAuthSession.mockReturnValue(session.promise)

    const first = useAuthStore.getState().restoreSession()
    const second = useAuthStore.getState().restoreSession()

    expect(authApiMock.fetchAuthSession).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().isRestoring).toBe(true)

    session.resolve({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      expiresInMs: null,
    })
    await Promise.all([first, second])

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: null,
      expiresAt: null,
    })
  })

  it('状態APIが失敗しても未認証として復元を完了する', async () => {
    authApiMock.fetchAuthSession.mockRejectedValue(new TypeError('Failed to fetch'))

    await useAuthStore.getState().restoreSession()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: null,
      expiresAt: null,
    })
  })

  it('ログイン成功時にCSRFトークンをメモリへ保持する', async () => {
    const expiresAt = Date.now() + 60_000
    authApiMock.loginWithCredentials.mockResolvedValue({
      ok: true,
      session: {
        isAuthenticated: true,
        csrfToken: 'csrf-login',
        expiresAt,
        expiresInMs: 60_000,
      },
    })
    useAuthStore.setState({ isLoginDialogOpen: true })

    const result = await useAuthStore.getState().login('  operator  ', 'entered-password')

    expect(result.ok).toBe(true)
    expect(authApiMock.loginWithCredentials).toHaveBeenCalledWith('operator', 'entered-password')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'csrf-login',
      expiresAt,
      isLoginDialogOpen: false,
    })
    expect(window.localStorage.length).toBe(0)
  })

  it('ログイン失敗時は未認証状態と理由を維持する', async () => {
    authApiMock.loginWithCredentials.mockResolvedValue({
      ok: false,
      reason: 'rate_limited',
      retryAfterSeconds: 60,
    })

    const result = await useAuthStore.getState().login('operator', 'wrong-password')

    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 60 })
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isSessionChecked: true,
      csrfToken: null,
      expiresAt: null,
    })
  })

  it('ログアウト成功時にサーバーへCSRFトークンを渡して状態を破棄する', async () => {
    const expiresAt = Date.now() + 60_000
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'csrf-logout',
      expiresAt,
    })
    authApiMock.logoutSession.mockResolvedValue({ ok: true })

    await expect(useAuthStore.getState().logout()).resolves.toBe(true)

    expect(authApiMock.logoutSession).toHaveBeenCalledWith('csrf-logout')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: false,
    })
  })

  it('401通知でセッションを破棄しログインダイアログを開く', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'stale-token',
      expiresAt: Date.now() + 60_000,
    })

    useAuthStore.getState().handleUnauthorized()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isSessionChecked: true,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: true,
    })
  })

  it('遅れて完了した起動restoreは新しいlogin状態を上書きしない', async () => {
    const staleSession = deferred<{
      isAuthenticated: false
      csrfToken: null
      expiresAt: null
      expiresInMs: null
    }>()
    authApiMock.fetchAuthSession.mockReturnValue(staleSession.promise)
    const restore = useAuthStore.getState().restoreSession()
    const expiresAt = Date.now() + 60_000
    authApiMock.loginWithCredentials.mockResolvedValue({
      ok: true,
      session: {
        isAuthenticated: true,
        csrfToken: 'csrf-new-login',
        expiresAt,
        expiresInMs: 60_000,
      },
    })

    await useAuthStore.getState().login('operator', 'entered-password')
    staleSession.resolve({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      expiresInMs: null,
    })
    await restore

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-new-login',
      expiresAt,
      isRestoring: false,
    })
  })

  it('遅れて完了した起動restoreは新しいlogout状態を上書きしない', async () => {
    const staleSession = deferred<{
      isAuthenticated: true
      csrfToken: string
      expiresAt: number
      expiresInMs: number
    }>()
    authApiMock.fetchAuthSession.mockReturnValue(staleSession.promise)
    const previousExpiresAt = Date.now() + 30_000
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: false,
      csrfToken: 'csrf-before-logout',
      expiresAt: previousExpiresAt,
    })
    const restore = useAuthStore.getState().restoreSession()
    authApiMock.logoutSession.mockResolvedValue({ ok: true })

    await useAuthStore.getState().logout()
    staleSession.resolve({
      isAuthenticated: true,
      csrfToken: 'csrf-stale-restore',
      expiresAt: Date.now() + 60_000,
      expiresInMs: 60_000,
    })
    await restore

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      isRestoring: false,
    })
  })

  it('遅れて完了した起動restoreは401後の未認証状態を上書きしない', async () => {
    const staleSession = deferred<{
      isAuthenticated: true
      csrfToken: string
      expiresAt: number
      expiresInMs: number
    }>()
    authApiMock.fetchAuthSession.mockReturnValue(staleSession.promise)
    const restore = useAuthStore.getState().restoreSession()

    useAuthStore.getState().handleUnauthorized()
    staleSession.resolve({
      isAuthenticated: true,
      csrfToken: 'csrf-stale-restore',
      expiresAt: Date.now() + 60_000,
      expiresInMs: 60_000,
    })
    await restore

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: true,
      isRestoring: false,
    })
  })

  it('force refreshでCookieに対応する最新セッションへ再同期する', async () => {
    const expiresAt = Date.now() + 60_000
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'csrf-stale',
      expiresAt: Date.now() + 30_000,
    })
    authApiMock.fetchAuthSession.mockResolvedValue({
      isAuthenticated: true,
      csrfToken: 'csrf-refreshed',
      expiresAt,
      expiresInMs: 60_000,
    })

    await useAuthStore.getState().forceRefreshSession()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: 'csrf-refreshed',
      expiresAt,
    })
  })

  it('logoutのCSRF不一致時はセッションを再同期して一度だけ再試行する', async () => {
    const expiresAt = Date.now() + 60_000
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'csrf-stale',
      expiresAt: Date.now() + 30_000,
    })
    authApiMock.logoutSession
      .mockResolvedValueOnce({ ok: false, reason: 'csrf_invalid' })
      .mockResolvedValueOnce({ ok: true })
    authApiMock.fetchAuthSession.mockResolvedValue({
      isAuthenticated: true,
      csrfToken: 'csrf-refreshed',
      expiresAt,
      expiresInMs: 60_000,
    })

    await expect(useAuthStore.getState().logout()).resolves.toBe(true)

    expect(authApiMock.fetchAuthSession).toHaveBeenCalledTimes(1)
    expect(authApiMock.logoutSession).toHaveBeenNthCalledWith(1, 'csrf-stale')
    expect(authApiMock.logoutSession).toHaveBeenNthCalledWith(2, 'csrf-refreshed')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
    })
  })

  it('logoutのCSRF不一致が再試行でも続く場合は追加試行しない', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: 'csrf-first',
      expiresAt: Date.now() + 30_000,
    })
    authApiMock.logoutSession.mockResolvedValue({ ok: false, reason: 'csrf_invalid' })
    authApiMock.fetchAuthSession
      .mockResolvedValueOnce({
        isAuthenticated: true,
        csrfToken: 'csrf-second',
        expiresAt: Date.now() + 60_000,
        expiresInMs: 60_000,
      })
      .mockResolvedValueOnce({
        isAuthenticated: true,
        csrfToken: 'csrf-third',
        expiresAt: Date.now() + 60_000,
        expiresInMs: 60_000,
      })

    await expect(useAuthStore.getState().logout()).resolves.toBe(false)

    expect(authApiMock.logoutSession).toHaveBeenCalledTimes(2)
    expect(authApiMock.fetchAuthSession).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-third',
    })
  })

  it('logoutのCSRF再同期に失敗した場合はログアウト成功として扱わない', async () => {
    const expiresAt = Date.now() + 60_000
    authApiMock.loginWithCredentials.mockResolvedValue({
      ok: true,
      session: {
        isAuthenticated: true,
        csrfToken: 'csrf-stale',
        expiresAt,
        expiresInMs: 60_000,
      },
    })
    await useAuthStore.getState().login('admin', 'password')
    authApiMock.logoutSession.mockResolvedValue({ ok: false, reason: 'csrf_invalid' })
    authApiMock.fetchAuthSession.mockRejectedValue(new Error('network error'))

    await expect(useAuthStore.getState().logout()).resolves.toBe(false)

    expect(authApiMock.logoutSession).toHaveBeenCalledTimes(1)
    expect(authApiMock.fetchAuthSession).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-stale',
      expiresAt,
    })
  })

  it('サーバー時計とずれていても相対有効期間で失効を判定する', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2070-07-17T00:00:00Z'))
    const serverExpiresAt = new Date('2026-07-17T00:00:01Z').getTime()
    authApiMock.loginWithCredentials.mockResolvedValue({
      ok: true,
      session: {
        isAuthenticated: true,
        csrfToken: 'csrf-expiring',
        expiresAt: serverExpiresAt,
        expiresInMs: 1_000,
      },
    })

    await useAuthStore.getState().login('operator', 'entered-password')
    vi.advanceTimersByTime(999)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    vi.advanceTimersByTime(1)
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: false,
    })
  })

  it('旧localStorageの削除が拒否されてもサーバーセッションを復元する', async () => {
    const expiresAt = Date.now() + 60_000
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })
    authApiMock.fetchAuthSession.mockResolvedValue({
      isAuthenticated: true,
      csrfToken: 'csrf-restored',
      expiresAt,
      expiresInMs: 60_000,
    })

    await expect(useAuthStore.getState().restoreSession()).resolves.toBeUndefined()

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-restored',
      expiresAt,
    })
  })

  it('復元中に開いたログインダイアログは認証済みセッション適用時に閉じる', async () => {
    const session = deferred<{
      isAuthenticated: true
      csrfToken: string
      expiresAt: number
      expiresInMs: number
    }>()
    authApiMock.fetchAuthSession.mockReturnValue(session.promise)
    const restore = useAuthStore.getState().restoreSession()
    useAuthStore.getState().openLoginDialog()

    session.resolve({
      isAuthenticated: true,
      csrfToken: 'csrf-restored',
      expiresAt: Date.now() + 60_000,
      expiresInMs: 60_000,
    })
    await restore

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoginDialogOpen: false,
    })
  })
})
