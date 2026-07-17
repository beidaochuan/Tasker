import { type ReactNode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import App from './App'

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/layout/ExportWarning', () => ({ ExportWarning: () => null }))
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined }))
vi.mock('@/components/views/ListView/ListView', () => ({ ListView: () => <div>list</div> }))
vi.mock('@/components/task/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('@/components/project/ProjectForm', () => ({ ProjectForm: () => null }))
vi.mock('@/components/auth/LoginDialog', () => ({ LoginDialog: () => null }))

const originalRestoreSession = useAuthStore.getState().restoreSession

describe('App auth bootstrap', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ restoreSession: originalRestoreSession })
  })

  it('起動時にサーバーセッションの復元を開始する', async () => {
    const restoreSession = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ restoreSession })
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await waitFor(() => expect(restoreSession).toHaveBeenCalledTimes(1))
  })
})
