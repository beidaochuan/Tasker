import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { ProjectForm } from './ProjectForm'

const { projectRepoMock } = vi.hoisted(() => ({
  projectRepoMock: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  projectRepo: projectRepoMock,
}))

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: '既存プロジェクト',
    description: '既存の説明',
    color: '#22c55e',
    status: 'active',
    isArchived: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 2),
    ...overrides,
  }
}

describe('ProjectForm', () => {
  beforeEach(() => {
    projectRepoMock.getById.mockReset()
    projectRepoMock.create.mockReset()
    projectRepoMock.update.mockReset()
    useAuthStore.setState({ isAuthenticated: true, isLoginDialogOpen: false })
    useUIStore.setState({
      isProjectFormOpen: false,
      editingProjectId: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('編集対象の取得完了後にプロジェクト情報をフォームへ反映する', async () => {
    let resolveProject: (value: { ok: true; data: Project }) => void = () => {}
    projectRepoMock.getById.mockReturnValue(
      new Promise((resolve) => {
        resolveProject = resolve
      })
    )

    act(() => {
      useUIStore.setState({ isProjectFormOpen: true, editingProjectId: 'proj-1' })
    })
    render(<ProjectForm />)

    expect(screen.getByLabelText('プロジェクト名')).toHaveValue('')
    expect(screen.getByLabelText('説明（省略可）')).toHaveValue('')

    await act(async () => {
      resolveProject({ ok: true, data: makeProject() })
    })

    await waitFor(() => {
      expect(screen.getByLabelText('プロジェクト名')).toHaveValue('既存プロジェクト')
      expect(screen.getByLabelText('説明（省略可）')).toHaveValue('既存の説明')
    })

    expect(projectRepoMock.getById).toHaveBeenCalledWith('proj-1')
  })

  it('開いたまま別プロジェクトの編集へ切り替えた場合も対象情報へ更新する', async () => {
    projectRepoMock.getById
      .mockResolvedValueOnce({ ok: true, data: makeProject({ id: 'proj-1', name: 'Project A' }) })
      .mockResolvedValueOnce({
        ok: true,
        data: makeProject({ id: 'proj-2', name: 'Project B', description: 'B の説明' }),
      })

    act(() => {
      useUIStore.setState({ isProjectFormOpen: true, editingProjectId: 'proj-1' })
    })
    const { rerender } = render(<ProjectForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('プロジェクト名')).toHaveValue('Project A')
    })

    act(() => {
      useUIStore.setState({ isProjectFormOpen: true, editingProjectId: 'proj-2' })
      rerender(<ProjectForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('プロジェクト名')).toHaveValue('Project B')
      expect(screen.getByLabelText('説明（省略可）')).toHaveValue('B の説明')
    })
  })
})
