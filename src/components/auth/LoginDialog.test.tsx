import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type LoginResult } from '@/store/authStore'
import { LoginDialog } from './LoginDialog'

const originalLogin = useAuthStore.getState().login
const loginMock = vi.fn<(username: string, password: string) => Promise<LoginResult>>()

describe('LoginDialog', () => {
  beforeEach(() => {
    loginMock.mockReset()
    useAuthStore.setState({
      isAuthenticated: false,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: true,
      login: loginMock,
    })
  })

  afterEach(() => {
    cleanup()
    useAuthStore.setState({ login: originalLogin })
  })

  it('資格情報が不正な場合は既存のエラー文言を表示する', async () => {
    const user = userEvent.setup()
    loginMock.mockResolvedValue({ ok: false, reason: 'invalid_credentials' })
    render(<LoginDialog />)

    await user.type(screen.getByLabelText('ユーザー名'), 'operator')
    await user.type(screen.getByLabelText('パスワード'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ユーザー名またはパスワードが違います'
    )
    expect(loginMock).toHaveBeenCalledWith('operator', 'wrong-password')
  })

  it('ログイン成功時はダイアログを閉じる', async () => {
    const user = userEvent.setup()
    loginMock.mockImplementation(async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        csrfToken: 'csrf-login',
        expiresAt: Date.now() + 60_000,
        isLoginDialogOpen: false,
      })
      return {
        ok: true,
        session: {
          isAuthenticated: true,
          csrfToken: 'csrf-login',
          expiresAt: Date.now() + 60_000,
          expiresInMs: 60_000,
        },
      }
    })
    render(<LoginDialog />)

    await user.type(screen.getByLabelText('ユーザー名'), 'operator')
    await user.type(screen.getByLabelText('パスワード'), 'entered-password')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(useAuthStore.getState().isLoginDialogOpen).toBe(false)
    })
  })

  it('429の場合は試行回数制限を表示し、処理中は二重送信を防ぐ', async () => {
    const user = userEvent.setup()
    let resolveLogin!: (result: LoginResult) => void
    loginMock.mockReturnValue(
      new Promise<LoginResult>((resolve) => {
        resolveLogin = resolve
      })
    )
    render(<LoginDialog />)

    await user.type(screen.getByLabelText('ユーザー名'), 'operator')
    await user.type(screen.getByLabelText('パスワード'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    const submit = screen.getByRole('button', { name: 'ログイン' })
    expect(submit).toBeDisabled()
    await user.click(submit)
    expect(loginMock).toHaveBeenCalledTimes(1)

    resolveLogin({ ok: false, reason: 'rate_limited', retryAfterSeconds: 60 })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ログイン試行回数が多すぎます。しばらく待ってから再試行してください'
    )
    expect(submit).toBeEnabled()
  })
})
