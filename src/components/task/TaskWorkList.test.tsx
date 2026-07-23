import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Subtask } from '@/types'
import { TaskWorkList } from './TaskWorkList'

const { dndMock, subtaskRepoMock } = vi.hoisted(() => ({
  dndMock: {
    onDragEnd: null as
      | ((event: { active: { id: string }; over: { id: string } | null }) => unknown)
      | null,
  },
  subtaskRepoMock: {
    getByTaskId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateOrder: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  subtaskRepo: subtaskRepoMock,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragEnd: NonNullable<typeof dndMock.onDragEnd>
  }) => {
    dndMock.onDragEnd = onDragEnd
    return children
  },
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}))

const SUBTASKS: Subtask[] = [
  {
    id: 'subtask-1',
    taskId: 'task-1',
    title: '仕様を確認',
    isDone: false,
    order: 0,
    createdAt: new Date(2026, 6, 10),
  },
  {
    id: 'subtask-2',
    taskId: 'task-1',
    title: 'レビューを依頼',
    isDone: true,
    order: 1,
    createdAt: new Date(2026, 6, 10),
  },
]

describe('TaskWorkList', () => {
  beforeEach(() => {
    subtaskRepoMock.getByTaskId.mockReset().mockResolvedValue({ ok: true, data: SUBTASKS })
    subtaskRepoMock.create.mockReset()
    subtaskRepoMock.update.mockReset()
    subtaskRepoMock.updateOrder.mockReset().mockResolvedValue({ ok: true, data: undefined })
    subtaskRepoMock.delete.mockReset().mockResolvedValue({ ok: true, data: undefined })
    dndMock.onDragEnd = null
  })

  afterEach(() => {
    cleanup()
  })

  it('既存タスクの作業一覧と進捗を表示する', async () => {
    render(<TaskWorkList taskId="task-1" canEdit />)

    expect(await screen.findByText('仕様を確認')).toBeInTheDocument()
    expect(screen.getByText('レビューを依頼')).toBeInTheDocument()
    expect(subtaskRepoMock.getByTaskId).toHaveBeenCalledWith('task-1')
    expect(screen.getByText('1 / 2 完了')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '作業リストの進捗' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(screen.getByRole('checkbox', { name: '「仕様を確認」を完了にする' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '「レビューを依頼」を未完了に戻す' })).toBeChecked()
  })

  it('Enterで作業を追加しても親フォームをsubmitしない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const created: Subtask = {
      id: 'subtask-3',
      taskId: 'task-1',
      title: 'テストを書く',
      isDone: false,
      order: 2,
      createdAt: new Date(2026, 6, 10),
    }
    subtaskRepoMock.create.mockResolvedValue({ ok: true, data: created })

    render(
      <form onSubmit={onSubmit}>
        <TaskWorkList taskId="task-1" canEdit />
      </form>
    )

    const input = await screen.findByLabelText('新しい作業')
    await user.type(input, '  テストを書く  {Enter}')

    await waitFor(() => {
      expect(subtaskRepoMock.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        title: 'テストを書く',
        isDone: false,
        order: 2,
      })
    })
    expect(await screen.findByText('テストを書く')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('日本語IMEの変換確定Enterでは作業を追加しない', async () => {
    render(<TaskWorkList taskId="task-1" canEdit />)

    const input = await screen.findByLabelText('新しい作業')
    fireEvent.change(input, { target: { value: '仕様を確認' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true })

    expect(subtaskRepoMock.create).not.toHaveBeenCalled()
    expect(input).toHaveValue('仕様を確認')
  })

  it('チェックボックスで完了状態を切り替える', async () => {
    const user = userEvent.setup()
    subtaskRepoMock.update.mockResolvedValue({
      ok: true,
      data: { ...SUBTASKS[0], isDone: true },
    })
    render(<TaskWorkList taskId="task-1" canEdit />)

    const checkbox = await screen.findByRole('checkbox', {
      name: '「仕様を確認」を完了にする',
    })
    await user.click(checkbox)

    await waitFor(() => {
      expect(subtaskRepoMock.update).toHaveBeenCalledWith('subtask-1', { isDone: true })
    })
    expect(
      await screen.findByRole('checkbox', { name: '「仕様を確認」を未完了に戻す' })
    ).toBeChecked()
    expect(screen.getByText('2 / 2 完了')).toBeInTheDocument()
  })

  it('作業タイトルを編集する', async () => {
    const user = userEvent.setup()
    subtaskRepoMock.update.mockResolvedValue({
      ok: true,
      data: { ...SUBTASKS[0], title: '仕様を再確認' },
    })
    render(<TaskWorkList taskId="task-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: '「仕様を確認」を編集' }))
    const input = screen.getByLabelText('作業内容')
    await user.clear(input)
    await user.type(input, '  仕様を再確認  {Enter}')

    await waitFor(() => {
      expect(subtaskRepoMock.update).toHaveBeenCalledWith('subtask-1', {
        title: '仕様を再確認',
      })
    })
    expect(await screen.findByText('仕様を再確認')).toBeInTheDocument()
  })

  it('日本語IMEの変換確定Enterでは作業タイトルを保存しない', async () => {
    const user = userEvent.setup()
    render(<TaskWorkList taskId="task-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: '「仕様を確認」を編集' }))
    const input = screen.getByLabelText('作業内容')
    fireEvent.change(input, { target: { value: '仕様を再確認' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true })

    expect(subtaskRepoMock.update).not.toHaveBeenCalled()
    expect(input).toHaveValue('仕様を再確認')
  })

  it('作業を削除する', async () => {
    const user = userEvent.setup()
    render(<TaskWorkList taskId="task-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: '「仕様を確認」を削除' }))

    await waitFor(() => {
      expect(subtaskRepoMock.delete).toHaveBeenCalledWith('subtask-1')
    })
    expect(screen.queryByText('仕様を確認')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 1 完了')).toBeInTheDocument()
  })

  it('ドラッグで作業の順序を入れ替え、まとめて保存する', async () => {
    render(<TaskWorkList taskId="task-1" canEdit />)

    await screen.findByText('仕様を確認')
    await act(async () => {
      await dndMock.onDragEnd?.({
        active: { id: 'subtask-2' },
        over: { id: 'subtask-1' },
      })
    })

    expect(subtaskRepoMock.updateOrder).toHaveBeenCalledWith([
      { id: 'subtask-2', order: 0 },
      { id: 'subtask-1', order: 1 },
    ])
    expect(
      screen.getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-label'))
    ).toEqual(['「レビューを依頼」を未完了に戻す', '「仕様を確認」を完了にする'])
  })

  it('未認証では作業リストを閲覧のみできる', async () => {
    render(<TaskWorkList taskId="task-1" canEdit={false} />)

    expect(await screen.findByText('仕様を確認')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '「仕様を確認」を完了にする' })).toBeDisabled()
    expect(screen.queryByLabelText('新しい作業')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '「仕様を確認」を編集' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '「仕様を確認」を削除' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '「仕様を確認」をドラッグして並べ替え' })
    ).toBeDisabled()
  })

  it('新規タスクでは作成後に追加できることを案内する', () => {
    render(<TaskWorkList taskId={null} canEdit />)

    expect(screen.getByText('タスクを作成すると作業を追加できます。')).toBeInTheDocument()
    expect(subtaskRepoMock.getByTaskId).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('新しい作業')).not.toBeInTheDocument()
  })

  it('読み込みに失敗した場合は再読み込みできる', async () => {
    const user = userEvent.setup()
    subtaskRepoMock.getByTaskId
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'DB_ERROR', message: '読み込みに失敗しました' },
      })
      .mockResolvedValueOnce({ ok: true, data: SUBTASKS })
    render(<TaskWorkList taskId="task-1" canEdit />)

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました')
    await user.click(screen.getByRole('button', { name: '再読み込み' }))

    expect(await screen.findByText('仕様を確認')).toBeInTheDocument()
    expect(subtaskRepoMock.getByTaskId).toHaveBeenCalledTimes(2)
  })
})
