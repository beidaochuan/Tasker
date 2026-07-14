import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types'
import { useUIStore } from '@/store/uiStore'
import { Sidebar } from './Sidebar'

const { useProjectsMock } = vi.hoisted(() => ({
  useProjectsMock: vi.fn(),
}))

vi.mock('@/hooks/useProjects', () => ({
  useProjects: useProjectsMock,
}))

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
    useProjectsMock.mockReset().mockReturnValue(PROJECTS)
    useUIStore.setState({ selectedProjectId: null })
  })

  afterEach(() => {
    cleanup()
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
})
