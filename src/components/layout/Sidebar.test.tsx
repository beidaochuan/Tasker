import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Sidebar } from './Sidebar'

const { useProjectsMock } = vi.hoisted(() => ({
  useProjectsMock: vi.fn(),
}))

const fetchMock = vi.fn()

vi.mock('@/hooks/useProjects', () => ({
  useProjects: useProjectsMock,
}))

// 現在のアプリバージョンより常に新しいことが保証されるダミーの最新版タグ
const NEWER_TAG = `v${Number(__APP_VERSION__.split('.')[0]) + 1}.0.0`

const PROJECTS: Project[] = [
  {
    id: 'project-1',
    name: 'プロジェクト1',
    description: '',
    color: '#22c55e',
    status: 'active',
    isArchived: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  },
  {
    id: 'project-2',
    name: 'プロジェクト2',
    description: '',
    color: '#3b82f6',
    status: 'active',
    isArchived: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  },
]

describe('Sidebar', () => {
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.14.1',
        html_url: 'https://github.com/beidaochuan/Tasker/releases/tag/v0.14.1',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    useProjectsMock.mockReset().mockReturnValue(PROJECTS)
    useUIStore.setState({
      selectedProjectId: null,
      isProjectFormOpen: false,
      editingProjectId: null,
    })
    useAuthStore.setState({
      isAuthenticated: false,
      isSessionChecked: true,
      isRestoring: false,
      csrfToken: null,
      isLoginDialogOpen: false,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('未選択の場合は一覧の先頭プロジェクトを選択する', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(useUIStore.getState().selectedProjectId).toBe('project-1')
    })
  })

  it('選択済みのプロジェクトが一覧に存在する場合は選択を維持する', async () => {
    useUIStore.setState({ selectedProjectId: 'project-2' })

    render(<Sidebar />)

    await waitFor(() => {
      expect(useUIStore.getState().selectedProjectId).toBe('project-2')
    })
  })

  it('サイドバー面と選択中プロジェクトを背景色以外でも区別する', async () => {
    useUIStore.setState({ selectedProjectId: 'project-2' })

    const { container } = render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'プロジェクト2' }).parentElement).toHaveClass(
        'border-l-primary',
        'bg-accent'
      )
    })
    expect(container.querySelector('aside')).toHaveClass('bg-panel')
  })

  it('閲覧モードでは新規プロジェクトボタンを表示しない', () => {
    render(<Sidebar />)

    expect(screen.queryByRole('button', { name: '新規プロジェクト' })).toBeNull()
    expect(screen.getByText('閲覧モード')).toBeInTheDocument()
    expect(useUIStore.getState().isProjectFormOpen).toBe(false)
  })

  it('認証済みでは新規プロジェクトボタンからフォームを開ける', () => {
    useAuthStore.setState({ isAuthenticated: true })
    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: '新規プロジェクト' }))

    expect(useUIStore.getState().isProjectFormOpen).toBe(true)
  })

  it('起動時に新しいGitHubリリースがあれば通知する', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: NEWER_TAG,
        html_url: `https://github.com/beidaochuan/Tasker/releases/tag/${NEWER_TAG}`,
      }),
    })

    render(<Sidebar />)

    expect(await screen.findByText('新しいバージョンがあります')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'GitHub Releases を開く' })).toHaveAttribute(
      'href',
      `https://github.com/beidaochuan/Tasker/releases/tag/${NEWER_TAG}`
    )
    expect(
      screen.getByRole('button', {
        name: `新しいバージョンがあります: ${NEWER_TAG}`,
        hidden: true,
      })
    ).toHaveAttribute('title', '新しいバージョンがあります')
  })

  it('新しいバージョンのアイコンから更新案内を再表示できる', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: NEWER_TAG,
        html_url: `https://github.com/beidaochuan/Tasker/releases/tag/${NEWER_TAG}`,
      }),
    })
    render(<Sidebar />)

    await screen.findByText('新しいバージョンがあります')
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    fireEvent.click(
      screen.getByRole('button', { name: `新しいバージョンがあります: ${NEWER_TAG}` })
    )

    expect(await screen.findByText('新しいバージョンがあります')).toBeInTheDocument()
  })

  it('1時間ごとにGitHubリリースを確認する', async () => {
    vi.useFakeTimers()
    render(<Sidebar />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    })

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === 'https://api.github.com/repos/beidaochuan/Tasker/releases/latest'
      )
    ).toHaveLength(2)
  })

  it('Windowsサービス版では通知からこの端末を更新できる', async () => {
    useAuthStore.setState({ isAuthenticated: true, csrfToken: 'csrf-token' })
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/update/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ canSelfUpdate: true }),
        })
      }
      if (url === '/api/update') {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({ started: true }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: NEWER_TAG,
          html_url: `https://github.com/beidaochuan/Tasker/releases/tag/${NEWER_TAG}`,
        }),
      })
    })

    render(<Sidebar />)

    const updateButton = await screen.findByRole('button', { name: 'この端末を更新' })
    expect(
      screen.getByText(/更新はTasker Windowsサービスの管理者権限で実行されます/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'GitHub Releases を開く' })).toBeNull()
    fireEvent.click(updateButton)

    expect(await screen.findByText('更新を実行中')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/update',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' })
    )
  })
})
