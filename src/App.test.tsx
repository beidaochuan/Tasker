import { type ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { runDailyBackupIfNeeded } from '@/utils/exportUtils'
import App from './App'

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
const { exportWarningSpy } = vi.hoisted(() => ({ exportWarningSpy: vi.fn(() => null) }))
vi.mock('@/components/layout/ExportWarning', () => ({ ExportWarning: exportWarningSpy }))
vi.mock('@/utils/exportUtils', () => ({
  runDailyBackupIfNeeded: vi.fn().mockResolvedValue(undefined),
}))
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
    vi.mocked(runDailyBackupIfNeeded).mockClear()
    exportWarningSpy.mockClear()
  })

  it('起動時にサーバーセッションの復元を開始する', async () => {
    const restoreSession = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ restoreSession })
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await waitFor(() => expect(restoreSession).toHaveBeenCalledTimes(1))
  })

  it('起動時に自動バックアップを試行する', async () => {
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await waitFor(() => expect(runDailyBackupIfNeeded).toHaveBeenCalledTimes(1))
  })

  it('自動バックアップを実行した場合は完了通知を表示する', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockResolvedValueOnce(true)
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await screen.findByText('本日分の自動バックアップを保存しました。')
  })

  it('その日すでに実行済みでスキップした場合は通知を表示しない', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockResolvedValueOnce(false)
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await waitFor(() => expect(runDailyBackupIfNeeded).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('本日分の自動バックアップを保存しました。')).toBeNull()
  })

  it('自動バックアップに失敗した場合は失敗通知を表示する', async () => {
    vi.mocked(runDailyBackupIfNeeded).mockRejectedValueOnce(new Error('network error'))
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    await screen.findByText(
      '自動バックアップに失敗しました。JSONエクスポートで手動保存してください。'
    )
  })

  it('自動バックアップの判定が完了するまでExportWarningをマウントしない', async () => {
    let resolveBackup: (didBackup: boolean) => void = () => {}
    vi.mocked(runDailyBackupIfNeeded).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveBackup = resolve
        })
    )
    useUIStore.setState({ activeView: 'list' })

    render(<App />)

    expect(exportWarningSpy).not.toHaveBeenCalled()

    resolveBackup(false)

    await waitFor(() => expect(exportWarningSpy).toHaveBeenCalled())
  })
})
