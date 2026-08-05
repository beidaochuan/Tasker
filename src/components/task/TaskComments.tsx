import { useEffect, useState } from 'react'
import { MessageSquare, Pencil, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TEXTAREA_CLASS } from '@/components/task/taskFieldStyles'
import { taskCommentRepo } from '@/repositories'
import type { TaskComment } from '@/types'
import { formatDateTime } from '@/utils/dateUtils'
import { unwrapResult } from '@/utils/resultUtils'

interface TaskCommentsProps {
  taskId: string | null
  canEdit: boolean
}

export function TaskComments({ taskId, canEdit }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newBody, setNewBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadCounter, setReloadCounter] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (!taskId) {
      return () => {
        cancelled = true
      }
    }

    Promise.resolve().then(() => {
      if (cancelled) return
      setIsLoading(true)
      setLoadError(null)
      setActionError(null)
      setEditingId(null)
      setNewBody('')
    })

    taskCommentRepo
      .getByTaskId(taskId)
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setComments(result.data)
        } else {
          setComments([])
          setLoadError(result.error.message || 'コメントの読み込みに失敗しました')
        }
        setLoadedTaskId(taskId)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setComments([])
        setLoadError(error instanceof Error ? error.message : 'コメントの読み込みに失敗しました')
        setLoadedTaskId(taskId)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, reloadCounter])

  const isLoadingCurrentTask = taskId !== null && (isLoading || loadedTaskId !== taskId)

  function setItemPending(id: string, isPending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current)
      if (isPending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleAdd() {
    const body = newBody.trim()
    if (!taskId || !canEdit || !body || isAdding) return

    setIsAdding(true)
    setActionError(null)
    try {
      const created = unwrapResult(await taskCommentRepo.create({ taskId, body }))
      setComments((current) => [created, ...current])
      setNewBody('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'コメントの追加に失敗しました')
    } finally {
      setIsAdding(false)
    }
  }

  function startEditing(comment: TaskComment) {
    setActionError(null)
    setEditingId(comment.id)
    setEditingBody(comment.body)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingBody('')
  }

  async function handleSaveEdit(comment: TaskComment) {
    const body = editingBody.trim()
    if (!canEdit || pendingIds.has(comment.id)) return
    if (!body) {
      setActionError('コメントを入力してください')
      return
    }
    if (body === comment.body) {
      cancelEditing()
      return
    }

    setItemPending(comment.id, true)
    setActionError(null)
    try {
      const updated = unwrapResult(await taskCommentRepo.update(comment.id, { body }))
      setComments((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      cancelEditing()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'コメントの更新に失敗しました')
    } finally {
      setItemPending(comment.id, false)
    }
  }

  async function handleDelete(comment: TaskComment) {
    if (!canEdit || pendingIds.has(comment.id)) return

    setItemPending(comment.id, true)
    setActionError(null)
    try {
      unwrapResult(await taskCommentRepo.delete(comment.id))
      setComments((current) => current.filter((item) => item.id !== comment.id))
      if (editingId === comment.id) cancelEditing()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'コメントの削除に失敗しました')
    } finally {
      setItemPending(comment.id, false)
    }
  }

  return (
    <section
      aria-labelledby="task-comments-title"
      className="space-y-3 rounded-md border border-border bg-background p-3"
    >
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        <h3 id="task-comments-title" className="text-sm font-semibold">
          コメント
        </h3>
      </div>

      {!taskId ? (
        <p className="text-xs text-muted-foreground">タスクを作成するとコメントを追加できます。</p>
      ) : isLoadingCurrentTask ? (
        <p role="status" className="py-2 text-center text-xs text-muted-foreground">
          コメントを読み込んでいます…
        </p>
      ) : loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-danger">
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true)
              setReloadCounter((value) => value + 1)
            }}
          >
            再読み込み
          </Button>
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="space-y-1.5">
              <label htmlFor="new-comment" className="sr-only">
                コメントを追加
              </label>
              <textarea
                id="new-comment"
                value={newBody}
                onChange={(event) => {
                  setNewBody(event.target.value)
                  setActionError(null)
                }}
                rows={3}
                className={TEXTAREA_CLASS}
                placeholder="コメントを追加"
                disabled={isAdding}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleAdd()}
                  disabled={isAdding || newBody.trim() === ''}
                >
                  追加
                </Button>
              </div>
            </div>
          )}

          {comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              コメントはまだありません
            </p>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => {
                const isPending = pendingIds.has(comment.id)
                const isEditing = editingId === comment.id

                return (
                  <li
                    key={comment.id}
                    className="group space-y-1 rounded-md border border-border px-2.5 py-1.5"
                  >
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <label htmlFor={`comment-${comment.id}`} className="sr-only">
                          コメント本文
                        </label>
                        <textarea
                          id={`comment-${comment.id}`}
                          value={editingBody}
                          onChange={(event) => setEditingBody(event.target.value)}
                          rows={3}
                          className={TEXTAREA_CLASS}
                          disabled={isPending}
                          autoFocus
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(comment)}
                            disabled={isPending}
                            aria-label="コメントの変更を保存"
                            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isPending}
                            aria-label="コメントの編集をキャンセル"
                            className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
                            {comment.body}
                          </p>
                          {canEdit && (
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => startEditing(comment)}
                                disabled={isPending}
                                aria-label="コメントを編集"
                                className="rounded-md p-1 text-muted-foreground opacity-70 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(comment)}
                                disabled={isPending}
                                aria-label="コメントを削除"
                                className="rounded-md p-1 text-muted-foreground opacity-70 hover:bg-accent hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(comment.createdAt)}
                          {comment.updatedAt.getTime() !== comment.createdAt.getTime() &&
                            '（編集済み）'}
                        </p>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {taskId && actionError && (
        <p role="alert" className="text-xs text-danger">
          {actionError}
        </p>
      )}
    </section>
  )
}
