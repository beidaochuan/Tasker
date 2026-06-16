import { create } from 'zustand'

const AUTH_STORAGE_KEY = 'tasker-authenticated'

export const LOGIN_USERNAME = 'admin'
export const LOGIN_PASSWORD = 'tasker'

function readStoredAuth(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

function writeStoredAuth(isAuthenticated: boolean) {
  if (typeof window === 'undefined') return
  if (isAuthenticated) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

interface AuthState {
  isAuthenticated: boolean
  isLoginDialogOpen: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
  openLoginDialog: () => void
  closeLoginDialog: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: readStoredAuth(),
  isLoginDialogOpen: false,

  login: (username, password) => {
    const ok = username.trim() === LOGIN_USERNAME && password === LOGIN_PASSWORD
    if (!ok) return false
    writeStoredAuth(true)
    set({ isAuthenticated: true, isLoginDialogOpen: false })
    return true
  },
  logout: () => {
    writeStoredAuth(false)
    set({ isAuthenticated: false, isLoginDialogOpen: false })
  },
  openLoginDialog: () => set({ isLoginDialogOpen: true }),
  closeLoginDialog: () => set({ isLoginDialogOpen: false }),
}))
