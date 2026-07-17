import { create } from 'zustand'
import {
  fetchAuthSession,
  loginWithCredentials,
  logoutSession,
  type AuthSession,
  type LoginResult,
} from '@/auth/authApi'

const LEGACY_AUTH_STORAGE_KEY = 'tasker-authenticated'
const MAX_TIMER_DELAY_MS = 2_147_483_647

function removeLegacyStoredAuth(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  } catch {
    // localStorageが無効でも、Cookieベースのセッション復元は継続する。
  }
}

interface AuthState {
  isAuthenticated: boolean
  isSessionChecked: boolean
  isRestoring: boolean
  csrfToken: string | null
  expiresAt: number | null
  isLoginDialogOpen: boolean
  restoreSession: () => Promise<void>
  forceRefreshSession: () => Promise<boolean>
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => Promise<boolean>
  handleUnauthorized: (expectedCsrfToken?: string | null) => void
  openLoginDialog: () => void
  closeLoginDialog: () => void
}

export const useAuthStore = create<AuthState>((set, get) => {
  let authGeneration = 0
  let restorePromise: Promise<void> | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null
  let localExpiryDeadline: number | null = null

  function clearExpiryTimer(): void {
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    expiryTimer = null
    localExpiryDeadline = null
  }

  function beginAuthTransition(): number {
    authGeneration += 1
    clearExpiryTimer()
    return authGeneration
  }

  function setUnauthenticated(): void {
    clearExpiryTimer()
    set({
      isAuthenticated: false,
      isSessionChecked: true,
      csrfToken: null,
      expiresAt: null,
    })
  }

  function scheduleExpiry(expiresInMs: number, generation: number): void {
    clearExpiryTimer()
    const deadline = Date.now() + expiresInMs
    localExpiryDeadline = deadline

    const expireWhenDue = () => {
      if (generation !== authGeneration) return
      const remaining = deadline - Date.now()
      if (remaining > 0) {
        expiryTimer = setTimeout(expireWhenDue, Math.min(remaining, MAX_TIMER_DELAY_MS))
        return
      }

      expiryTimer = null
      localExpiryDeadline = null
      authGeneration += 1
      set({
        isAuthenticated: false,
        isSessionChecked: true,
        isRestoring: false,
        csrfToken: null,
        expiresAt: null,
      })
    }

    expiryTimer = setTimeout(expireWhenDue, Math.min(expiresInMs, MAX_TIMER_DELAY_MS))
  }

  function applySession(session: AuthSession, generation: number): boolean {
    if (generation !== authGeneration) return false
    if (!session.isAuthenticated || session.expiresInMs <= 0) {
      setUnauthenticated()
      return true
    }

    set({
      isAuthenticated: true,
      isSessionChecked: true,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      isLoginDialogOpen: false,
    })
    scheduleExpiry(session.expiresInMs, generation)
    return true
  }

  async function synchronizeSession(generation: number): Promise<boolean> {
    let applied = false
    try {
      const session = await fetchAuthSession()
      applied = applySession(session, generation)
    } catch {
      if (generation === authGeneration) {
        setUnauthenticated()
      }
    } finally {
      if (generation === authGeneration) set({ isRestoring: false })
    }
    return applied
  }

  async function attemptLogout(allowCsrfRetry: boolean): Promise<boolean> {
    const previousSession = {
      isAuthenticated: get().isAuthenticated,
      csrfToken: get().csrfToken,
      expiresAt: get().expiresAt,
      localExpiryDeadline,
    }
    const restorePreviousSession = (restoreGeneration: number) => {
      const remaining = previousSession.localExpiryDeadline
        ? previousSession.localExpiryDeadline - Date.now()
        : 0
      if (
        previousSession.isAuthenticated &&
        previousSession.csrfToken &&
        previousSession.expiresAt &&
        remaining > 0
      ) {
        set({
          isAuthenticated: true,
          isSessionChecked: true,
          csrfToken: previousSession.csrfToken,
          expiresAt: previousSession.expiresAt,
        })
        scheduleExpiry(remaining, restoreGeneration)
      } else {
        setUnauthenticated()
      }
    }
    const generation = beginAuthTransition()
    set({ isRestoring: false, isSessionChecked: true })
    const result = await logoutSession(previousSession.csrfToken)
    if (generation !== authGeneration) return false

    if (result.ok) {
      setUnauthenticated()
      set({ isLoginDialogOpen: false })
      return true
    }

    if (result.reason === 'csrf_invalid') {
      const refreshPromise = get().forceRefreshSession()
      const refreshGeneration = authGeneration
      const refreshApplied = await refreshPromise
      if (refreshGeneration !== authGeneration) return false
      if (!refreshApplied) {
        restorePreviousSession(refreshGeneration)
        return false
      }
      if (!get().isAuthenticated) {
        set({ isLoginDialogOpen: false })
        return true
      }
      return allowCsrfRetry ? attemptLogout(false) : false
    }

    restorePreviousSession(generation)
    return false
  }

  return {
    isAuthenticated: false,
    isSessionChecked: false,
    isRestoring: false,
    csrfToken: null,
    expiresAt: null,
    isLoginDialogOpen: false,

    restoreSession: () => {
      removeLegacyStoredAuth()
      if (get().isSessionChecked) return Promise.resolve()
      if (restorePromise) return restorePromise

      const generation = authGeneration
      set({ isRestoring: true })
      restorePromise = synchronizeSession(generation)
        .then(() => undefined)
        .finally(() => {
          restorePromise = null
        })
      return restorePromise
    },

    forceRefreshSession: () => {
      const generation = beginAuthTransition()
      set({ isRestoring: true, isSessionChecked: false })
      return synchronizeSession(generation)
    },

    login: async (username, password) => {
      const generation = beginAuthTransition()
      set({ isRestoring: false, isSessionChecked: true })
      const result = await loginWithCredentials(username.trim(), password)
      if (generation !== authGeneration) return { ok: false, reason: 'unavailable' }

      if (result.ok && result.session.expiresInMs > 0) {
        set({
          isAuthenticated: true,
          isSessionChecked: true,
          csrfToken: result.session.csrfToken,
          expiresAt: result.session.expiresAt,
          isLoginDialogOpen: false,
        })
        scheduleExpiry(result.session.expiresInMs, generation)
        return result
      }

      setUnauthenticated()
      return result.ok ? { ok: false, reason: 'unavailable' } : result
    },

    logout: () => attemptLogout(true),

    handleUnauthorized: (expectedCsrfToken) => {
      if (expectedCsrfToken !== undefined && get().csrfToken !== expectedCsrfToken) return
      beginAuthTransition()
      setUnauthenticated()
      set({ isRestoring: false, isLoginDialogOpen: true })
    },
    openLoginDialog: () => set({ isLoginDialogOpen: true }),
    closeLoginDialog: () => set({ isLoginDialogOpen: false }),
  }
})

export type { LoginResult }
