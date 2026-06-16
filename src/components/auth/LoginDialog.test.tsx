import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOGIN_PASSWORD, LOGIN_USERNAME, useAuthStore } from '@/store/authStore'
import { LoginDialog } from './LoginDialog'

describe('LoginDialog', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ isAuthenticated: false, isLoginDialogOpen: true })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows an error for invalid credentials', async () => {
    const user = userEvent.setup()
    render(<LoginDialog />)

    await user.type(screen.getByLabelText('ユーザー名'), LOGIN_USERNAME)
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByRole('alert')).toHaveTextContent('ユーザー名またはパスワードが違います')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('logs in with valid credentials', async () => {
    const user = userEvent.setup()
    render(<LoginDialog />)

    await user.type(screen.getByLabelText('ユーザー名'), LOGIN_USERNAME)
    await user.type(screen.getByLabelText('パスワード'), LOGIN_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().isLoginDialogOpen).toBe(false)
  })
})
