import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    taskId: 1,
    body: '2番目のコメント',
    createdAt: new Date(2026, 6, 11),
    updatedAt: new Date(2026, 6, 11),
  },
  {
    id: 'comment-1',
    taskId: 1,
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
    render(<TaskComments taskId={1} canEdit />)

    expect(await screen.findByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.getByTaskId).toHaveBeenCalledWith(1)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('2番目のコメント')
    expect(items[1]).toHaveTextContent('最初のコメント')
  })

  it('コメントを追加する', async () => {
    const user = userEvent.setup()
    const created: TaskComment = {
      id: 'comment-3',
      taskId: 1,
      body: '新しいコメント',
      createdAt: new Date(2026, 6, 12),
      updatedAt: new Date(2026, 6, 12),
    }
    taskCommentRepoMock.create.mockResolvedValue({ ok: true, data: created })
    render(<TaskComments taskId={1} canEdit />)

    const textarea = await screen.findByPlaceholderText('コメントを追加')
    await user.type(textarea, '新しいコメント')
    await user.click(screen.getByRole('button', { name: '追加' }))

    await waitFor(() => {
      expect(taskCommentRepoMock.create).toHaveBeenCalledWith({
        taskId: 1,
        body: '新しいコメント',
      })
    })
    expect(await screen.findByText('新しいコメント')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it.each(['編集ボタン', '本文'] as const)(
    '%sのシングルクリックでコメントを編集する',
    async (target) => {
      const user = userEvent.setup()
      taskCommentRepoMock.update.mockResolvedValue({
        ok: true,
        data: { ...COMMENTS[0], body: '編集後のコメント' },
      })
      render(<TaskComments taskId={1} canEdit />)

      await user.click(
        target === '本文'
          ? await screen.findByText('2番目のコメント')
          : (await screen.findAllByRole('button', { name: 'コメントを編集' }))[0]
      )
      const editArea = screen.getByLabelText('コメント本文')
      expect(editArea).toHaveValue('2番目のコメント')
      expect(editArea).toHaveFocus()
      await user.clear(editArea)
      await user.type(editArea, '編集後のコメント')
      await user.click(screen.getByRole('button', { name: 'コメントの変更を保存' }))

      await waitFor(() => {
        expect(taskCommentRepoMock.update).toHaveBeenCalledWith('comment-2', {
          body: '編集後のコメント',
        })
      })
      expect(await screen.findByText('編集後のコメント')).toBeInTheDocument()
    }
  )

  it('本文をクリックして編集した内容をキャンセルすると元のコメントを保持する', async () => {
    const user = userEvent.setup()
    render(<TaskComments taskId={1} canEdit />)

    await user.click(await screen.findByText('2番目のコメント'))
    const textarea = screen.getByLabelText('コメント本文')
    await user.clear(textarea)
    await user.type(textarea, '保存しない変更')
    await user.click(screen.getByRole('button', { name: 'コメントの編集をキャンセル' }))

    expect(screen.queryByLabelText('コメント本文')).not.toBeInTheDocument()
    expect(screen.getByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.update).not.toHaveBeenCalled()
    await user.click(screen.getByText('2番目のコメント'))
    expect(screen.getByLabelText('コメント本文')).toHaveValue('2番目のコメント')
  })

  it('コメント行はポインターを合わせると背景が変化する', async () => {
    render(<TaskComments taskId={1} canEdit />)

    const commentBody = await screen.findByText('2番目のコメント')
    expect(commentBody.closest('li')).toHaveClass('transition-colors', 'hover:bg-accent/40')
  })

  it('本文をクリックして編集した内容をEscapeでキャンセルする', async () => {
    const user = userEvent.setup()
    render(<TaskComments taskId={1} canEdit />)

    await user.click(await screen.findByText('2番目のコメント'))
    const textarea = screen.getByLabelText('コメント本文')
    await user.clear(textarea)
    await user.type(textarea, '保存しない変更{Escape}')

    expect(screen.queryByLabelText('コメント本文')).not.toBeInTheDocument()
    expect(screen.getByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.update).not.toHaveBeenCalled()
  })

  it('削除処理中はコメント本文をクリックしても編集を開始しない', async () => {
    const user = userEvent.setup()
    let finishDelete!: () => void
    taskCommentRepoMock.delete.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDelete = () => resolve({ ok: true, data: undefined })
        })
    )
    render(<TaskComments taskId={1} canEdit />)

    await user.click((await screen.findAllByRole('button', { name: 'コメントを削除' }))[0])
    await user.click(screen.getByText('2番目のコメント'))
    expect(screen.queryByLabelText('コメント本文')).not.toBeInTheDocument()
    expect(taskCommentRepoMock.update).not.toHaveBeenCalled()

    await act(async () => finishDelete())
    expect(screen.queryByText('2番目のコメント')).not.toBeInTheDocument()
    expect(taskCommentRepoMock.delete).toHaveBeenCalledExactlyOnceWith('comment-2')
  })

  describe.each(['追加', '編集'] as const)('コメントの%s時のキーボード操作', (mode) => {
    async function prepareInput() {
      const user = userEvent.setup()
      taskCommentRepoMock.create.mockResolvedValue({
        ok: true,
        data: { ...COMMENTS[0], id: 'comment-3', body: '入力したコメント' },
      })
      taskCommentRepoMock.update.mockResolvedValue({
        ok: true,
        data: { ...COMMENTS[0], body: '入力したコメント' },
      })
      render(<TaskComments taskId={1} canEdit />)

      let textarea = await screen.findByLabelText('コメントを追加')
      if (mode === '編集') {
        await user.click(screen.getAllByRole('button', { name: 'コメントを編集' })[0])
        textarea = screen.getByLabelText('コメント本文')
        await user.clear(textarea)
      }
      await user.type(textarea, '入力したコメント')
      return { user, textarea }
    }

    it.each([
      ['Ctrl+Enter', '{Control>}{Enter}{/Control}'],
      ['Command+Enter', '{Meta>}{Enter}{/Meta}'],
    ])('%sで確定できる', async (_, keys) => {
      const { user, textarea } = await prepareInput()

      await user.keyboard(keys)

      if (mode === '追加') {
        expect(taskCommentRepoMock.create).toHaveBeenCalledExactlyOnceWith({
          taskId: 1,
          body: '入力したコメント',
        })
        await waitFor(() => expect(textarea).toHaveValue(''))
      } else {
        expect(taskCommentRepoMock.update).toHaveBeenCalledExactlyOnceWith('comment-2', {
          body: '入力したコメント',
        })
        await waitFor(() => expect(screen.queryByLabelText('コメント本文')).not.toBeInTheDocument())
      }
      expect(await screen.findByText('入力したコメント')).toBeInTheDocument()
    })

    it.each([
      ['Enter', '{Enter}'],
      ['Shift+Enter', '{Shift>}{Enter}{/Shift}'],
    ])('%sは送信せず改行する', async (_, keys) => {
      const { user, textarea } = await prepareInput()

      await user.keyboard(keys)
      await user.type(textarea, '次の行')

      expect(textarea).toHaveValue('入力したコメント\n次の行')
      expect(taskCommentRepoMock.create).not.toHaveBeenCalled()
      expect(taskCommentRepoMock.update).not.toHaveBeenCalled()
    })

    it.each([
      ['Ctrl+Enter', { ctrlKey: true }, { isComposing: true }],
      ['Command+Enter', { metaKey: true }, { isComposing: true }],
      ['Ctrl+Enter（keyCode 229）', { ctrlKey: true }, { keyCode: 229 }],
      ['Command+Enter（keyCode 229）', { metaKey: true }, { keyCode: 229 }],
    ])('日本語変換中の%sでは確定しない', async (_, modifier, composition) => {
      const { textarea } = await prepareInput()

      fireEvent.keyDown(textarea, {
        key: 'Enter',
        code: 'Enter',
        ...modifier,
        ...composition,
      })

      expect(textarea).toHaveValue('入力したコメント')
      expect(taskCommentRepoMock.create).not.toHaveBeenCalled()
      expect(taskCommentRepoMock.update).not.toHaveBeenCalled()
    })
  })

  it('コメントを削除する', async () => {
    const user = userEvent.setup()
    render(<TaskComments taskId={1} canEdit />)

    await user.click((await screen.findAllByRole('button', { name: 'コメントを削除' }))[0])

    await waitFor(() => {
      expect(taskCommentRepoMock.delete).toHaveBeenCalledWith('comment-2')
    })
    expect(screen.queryByText('2番目のコメント')).not.toBeInTheDocument()
  })

  it('未認証ではコメントを閲覧のみできる', async () => {
    const user = userEvent.setup()
    render(<TaskComments taskId={1} canEdit={false} />)

    await user.click(await screen.findByText('2番目のコメント'))
    expect(screen.queryByLabelText('コメント本文')).not.toBeInTheDocument()
    expect(taskCommentRepoMock.update).not.toHaveBeenCalled()
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
    render(<TaskComments taskId={1} canEdit />)

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました')
    await user.click(screen.getByRole('button', { name: '再読み込み' }))

    expect(await screen.findByText('2番目のコメント')).toBeInTheDocument()
    expect(taskCommentRepoMock.getByTaskId).toHaveBeenCalledTimes(2)
  })
})
