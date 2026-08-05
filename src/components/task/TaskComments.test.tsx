import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskComment } from '@/types'
import { TaskComments } from './TaskComments'

const { taskCommentRepoMock } = vi.hoisted(() => ({
  taskCommentRepoMock: {
    getByTaskId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  taskCommentRepo: taskCommentRepoMock,
}))

const COMMENTS: TaskComment[] = [
  {
    id: 'comment-2',
    taskId: 'task-1',
    body: '2番目のコメント',
    createdAt: new Date(2026, 6, 11),
    updatedAt: new Date(2026, 6, 11),
  },
  {
    id: 'comment-1',
    taskId: 'task-1',
    body: '最初のコメント',
    createdAt: new Date(2026, 6, 10),
    updatedAt: new Date(2026, 6, 10),
  },
]

describe('TaskComments', () => {
  beforeEach(() => {
    taskCommentRepoMock.getByTaskId.mockReset().mockResolvedValue({ ok: true, data: COMMENTS })
    taskCommentRepoMock.create.mockReset()
    taskCommentRepoMock.update.mockReset()
    taskCommentRepoMock.delete.mockReset().mockResolvedValue({ ok: true, data: undefined })
  })

  afterEach(() => {
    cleanup()
  })

  it('既存タスクのコメント一覧をAPIが返した順序（新しい順）のまま表示する', async () => {
    render(<TaskComments taskId="task-1" canEdit />)

    expect(await screen.findByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.getByTaskId).toHaveBeenCalledWith('task-1')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('2番目のコメント')
    expect(items[1]).toHaveTextContent('最初のコメント')
  })

  it('コメントを追加する', async () => {
    const user = userEvent.setup()
    const created: TaskComment = {
      id: 'comment-3',
      taskId: 'task-1',
      body: '新しいコメント',
      createdAt: new Date(2026, 6, 12),
      updatedAt: new Date(2026, 6, 12),
    }
    taskCommentRepoMock.create.mockResolvedValue({ ok: true, data: created })
    render(<TaskComments taskId="task-1" canEdit />)

    const textarea = await screen.findByPlaceholderText('コメントを追加')
    await user.type(textarea, '新しいコメント')
    await user.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(taskCommentRepoMock.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        body: '新しいコメント',
      })
    })
    expect(await screen.findByText('新しいコメント')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it('コメントを編集する', async () => {
    const user = userEvent.setup()
    taskCommentRepoMock.update.mockResolvedValue({
      ok: true,
      data: { ...COMMENTS[0], body: '編集後のコメント' },
    })
    render(<TaskComments taskId="task-1" canEdit />)

    await user.click((await screen.findAllByRole('button', { name: 'コメントを編集' }))[0])
    const editArea = screen.getByLabelText('コメント本文')
    await user.clear(editArea)
    await user.type(editArea, '編集後のコメント')
    await user.click(screen.getByRole('button', { name: 'コメントの変更を保存' }))

    await waitFor(() => {
      expect(taskCommentRepoMock.update).toHaveBeenCalledWith('comment-2', {
        body: '編集後のコメント',
      })
    })
    expect(await screen.findByText('編集後のコメント')).toBeInTheDocument()
  })

  it('コメントを削除する', async () => {
    const user = userEvent.setup()
    render(<TaskComments taskId="task-1" canEdit />)

    await user.click((await screen.findAllByRole('button', { name: 'コメントを削除' }))[0])

    await waitFor(() => {
      expect(taskCommentRepoMock.delete).toHaveBeenCalledWith('comment-2')
    })
    expect(screen.queryByText('2番目のコメント')).not.toBeInTheDocument()
  })

  it('未認証ではコメントを閲覧のみできる', async () => {
    render(<TaskComments taskId="task-1" canEdit={false} />)

    expect(await screen.findByText('2番目のコメント')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('コメントを追加')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'コメントを編集' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'コメントを削除' })).not.toBeInTheDocument()
  })

  it('新規タスクでは作成後に追加できることを案内する', () => {
    render(<TaskComments taskId={null} canEdit />)

    expect(screen.getByText('タスクを作成するとコメントを追加できます。')).toBeInTheDocument()
    expect(taskCommentRepoMock.getByTaskId).not.toHaveBeenCalled()
  })

  it('読み込みに失敗した場合は再読み込みできる', async () => {
    const user = userEvent.setup()
    taskCommentRepoMock.getByTaskId
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'DB_ERROR', message: '読み込みに失敗しました' },
      })
      .mockResolvedValueOnce({ ok: true, data: COMMENTS })
    render(<TaskComments taskId="task-1" canEdit />)

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました')
    await user.click(screen.getByRole('button', { name: '再読み込み' }))

    expect(await screen.findByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.getByTaskId).toHaveBeenCalledTimes(2)
  })
})
