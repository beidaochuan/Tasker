import { beforeEach, describe, expect, it } from 'vitest'
import { LOGIN_PASSWORD, LOGIN_USERNAME, useAuthStore } from '../authStore'

describe('authStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ isAuthenticated: false, isLoginDialogOpen: false })
  })

  it('logs in with fixed credentials and persists the state', () => {
    const ok = useAuthStore.getState().login(LOGIN_USERNAME, LOGIN_PASSWORD)

    expect(ok).toBe(true)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(window.localStorage.getItem('tasker-authenticated')).toBe('true')
  })

  it('rejects invalid credentials', () => {
    const ok = useAuthStore.getState().login(LOGIN_USERNAME, 'wrong')

    expect(ok).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage.getItem('tasker-authenticated')).toBeNull()
  })

  it('logs out and clears the persisted state', () => {
    useAuthStore.getState().login(LOGIN_USERNAME, LOGIN_PASSWORD)

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage.getItem('tasker-authenticated')).toBeNull()
  })
})
