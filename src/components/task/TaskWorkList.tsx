import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subtaskRepo } from '@/repositories'
import type { Subtask } from '@/types'
import { cn } from '@/utils/cn'
import { unwrapResult } from '@/utils/resultUtils'
import { sortByOrder } from '@/utils/sortUtils'

interface TaskWorkListProps {
  taskId: string | null
  canEdit: boolean
}

const ITEM_INPUT_CLASS =
  'h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20'

export function TaskWorkList({ taskId, canEdit }: TaskWorkListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
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
      setNewTitle('')
    })

    subtaskRepo
      .getByTaskId(taskId)
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setSubtasks(sortByOrder(result.data))
        } else {
          setSubtasks([])
          setLoadError(result.error.message || '作業リストの読み込みに失敗しました')
        }
        setLoadedTaskId(taskId)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSubtasks([])
        setLoadError(error instanceof Error ? error.message : '作業リストの読み込みに失敗しました')
        setLoadedTaskId(taskId)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, reloadCounter])

  const doneCount = useMemo(
    () => subtasks.reduce((count, subtask) => count + (subtask.isDone ? 1 : 0), 0),
    [subtasks]
  )
  const progress = subtasks.length === 0 ? 0 : Math.floor((doneCount / subtasks.length) * 100)
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
    const title = newTitle.trim()
    if (!taskId || !canEdit || !title || isAdding) return

    setIsAdding(true)
    setActionError(null)
    try {
      const order = subtasks.reduce((max, subtask) => Math.max(max, subtask.order), -1) + 1
      const created = unwrapResult(
        await subtaskRepo.create({ taskId, title, isDone: false, order })
      )
      setSubtasks((current) => sortByOrder([...current, created]))
      setNewTitle('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '作業の追加に失敗しました')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleToggle(subtask: Subtask) {
    if (!canEdit || pendingIds.has(subtask.id)) return

    setItemPending(subtask.id, true)
    setActionError(null)
    try {
      const updated = unwrapResult(
        await subtaskRepo.update(subtask.id, { isDone: !subtask.isDone })
      )
      setSubtasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '完了状態の更新に失敗しました')
    } finally {
      setItemPending(subtask.id, false)
    }
  }

  function startEditing(subtask: Subtask) {
    setActionError(null)
    setEditingId(subtask.id)
    setEditingTitle(subtask.title)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingTitle('')
  }

  async function handleRename(subtask: Subtask) {
    const title = editingTitle.trim()
    if (!canEdit || pendingIds.has(subtask.id)) return
    if (!title) {
      setActionError('作業内容を入力してください')
      return
    }
    if (title === subtask.title) {
      cancelEditing()
      return
    }

    setItemPending(subtask.id, true)
    setActionError(null)
    try {
      const updated = unwrapResult(await subtaskRepo.update(subtask.id, { title }))
      setSubtasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      cancelEditing()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '作業内容の更新に失敗しました')
    } finally {
      setItemPending(subtask.id, false)
    }
  }

  async function handleDelete(subtask: Subtask) {
    if (!canEdit || pendingIds.has(subtask.id)) return

    setItemPending(subtask.id, true)
    setActionError(null)
    try {
      unwrapResult(await subtaskRepo.delete(subtask.id))
      setSubtasks((current) => current.filter((item) => item.id !== subtask.id))
      if (editingId === subtask.id) cancelEditing()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '作業の削除に失敗しました')
    } finally {
      setItemPending(subtask.id, false)
    }
  }

  return (
    <section
      aria-labelledby="task-work-list-title"
      className="space-y-3 rounded-md border border-border bg-background p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="task-work-list-title" className="text-sm font-semibold">
          作業リスト
        </h3>
        {taskId && !isLoadingCurrentTask && !loadError && (
          <span className="text-xs text-muted-foreground">
            {doneCount} / {subtasks.length} 完了
          </span>
        )}
      </div>

      {taskId && !isLoadingCurrentTask && !loadError && subtasks.length > 0 && (
        <div
          role="progressbar"
          aria-label="作業リストの進捗"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${doneCount} / ${subtasks.length} 完了`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {!taskId ? (
        <p className="text-xs text-muted-foreground">タスクを作成すると作業を追加できます。</p>
      ) : isLoadingCurrentTask ? (
        <p role="status" className="py-2 text-center text-xs text-muted-foreground">
          作業リストを読み込んでいます…
        </p>
      ) : loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
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
          <div className="space-y-1">
            {subtasks.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">作業はまだありません</p>
            )}

            {subtasks.map((subtask) => {
              const isPending = pendingIds.has(subtask.id)
              const isEditing = editingId === subtask.id

              return (
                <div
                  key={subtask.id}
                  className="group flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={subtask.isDone}
                    onChange={() => void handleToggle(subtask)}
                    disabled={!canEdit || isPending}
                    aria-label={`「${subtask.title}」を${subtask.isDone ? '未完了に戻す' : '完了にする'}`}
                    className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  />

                  {isEditing ? (
                    <>
                      <label htmlFor={`work-item-${subtask.id}`} className="sr-only">
                        作業内容
                      </label>
                      <input
                        id={`work-item-${subtask.id}`}
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleRename(subtask)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelEditing()
                          }
                        }}
                        disabled={isPending}
                        autoFocus
                        className={ITEM_INPUT_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(subtask)}
                        disabled={isPending}
                        aria-label={`「${subtask.title}」の変更を保存`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isPending}
                        aria-label={`「${subtask.title}」の編集をキャンセル`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          'min-w-0 flex-1 break-words text-sm',
                          subtask.isDone &&
                            'text-muted-foreground line-through decoration-foreground/40'
                        )}
                      >
                        {subtask.title}
                      </span>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(subtask)}
                            disabled={isPending}
                            aria-label={`「${subtask.title}」を編集`}
                            className="rounded-md p-1 text-muted-foreground opacity-70 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(subtask)}
                            disabled={isPending}
                            aria-label={`「${subtask.title}」を削除`}
                            className="rounded-md p-1 text-muted-foreground opacity-70 hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {canEdit && (
            <div className="flex gap-2 pt-1">
              <label htmlFor="new-work-item" className="sr-only">
                新しい作業
              </label>
              <input
                id="new-work-item"
                value={newTitle}
                onChange={(event) => {
                  setNewTitle(event.target.value)
                  setActionError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAdd()
                  }
                }}
                placeholder="作業を追加"
                className={ITEM_INPUT_CLASS}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void handleAdd()}
                disabled={isAdding || newTitle.trim() === ''}
              >
                <Plus className="h-3.5 w-3.5" />
                追加
              </Button>
            </div>
          )}
        </>
      )}

      {taskId && actionError && (
        <p role="alert" className="text-xs text-destructive">
          {actionError}
        </p>
      )}
    </section>
  )
}
