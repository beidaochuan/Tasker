import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { SortableTaskRow } from '@/components/task/SortableTaskRow'
import { useFilteredTasksByTopic } from '@/hooks/useFilteredTasks'
import { useFilterStore, selectIsFiltering } from '@/store/filterStore'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { taskRepo, topicRepo } from '@/repositories'
import { reorderItems } from '@/utils/sortUtils'
import { unwrapResult } from '@/utils/resultUtils'
import type { Task, Topic } from '@/types'

interface TopicRowProps {
  topic: Topic
  canEdit: boolean
  onAddTask: (topicId: string) => void
}

function moveCompletedTasksToEnd(tasks: Task[]): Task[] {
  const activeTasks = tasks.filter((task) => task.status !== 'done')
  const completedTasks = tasks.filter((task) => task.status === 'done')
  return [...activeTasks, ...completedTasks]
}

export function TopicRow({ topic, canEdit, onAddTask }: TopicRowProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const tasks = useFilteredTasksByTopic(topic.id)
  const [pendingTaskOrder, setPendingTaskOrder] = useState<string[] | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const reorderingRef = useRef(false)
  const isFiltering = useFilterStore(selectIsFiltering)
  const refresh = useRefreshStore((s) => s.refresh)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const displayedTasks = useMemo(() => {
    if (!pendingTaskOrder) return moveCompletedTasksToEnd(tasks)

    const pendingIds = new Set(pendingTaskOrder)
    const taskById = new Map(tasks.map((task) => [task.id, task]))
    const orderedPendingTasks = pendingTaskOrder.flatMap((id) => {
      const task = taskById.get(id)
      return task ? [task] : []
    })
    let taskIndex = 0

    return moveCompletedTasksToEnd(
      tasks.map((task) =>
        pendingIds.has(task.id) ? (orderedPendingTasks[taskIndex++] ?? task) : task
      )
    )
  }, [pendingTaskOrder, tasks])

  useEffect(() => {
    if (!pendingTaskOrder) return

    const savedTaskIds = tasks.map((task) => task.id)
    const savedTaskIdSet = new Set(savedTaskIds)
    const pendingIds = new Set(pendingTaskOrder)
    const hasMissingTask = pendingTaskOrder.some((id) => !savedTaskIdSet.has(id))
    const savedPendingTaskIds = savedTaskIds.filter((id) => pendingIds.has(id))
    const isSettled =
      savedPendingTaskIds.length === pendingTaskOrder.length &&
      savedPendingTaskIds.every((id, index) => id === pendingTaskOrder[index])
    if (!hasMissingTask && !isSettled) return

    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setPendingTaskOrder(null)
    })
    return () => {
      cancelled = true
    }
  }, [pendingTaskOrder, tasks])

  function startEditingName() {
    if (!canEdit) return
    flushSync(() => {
      setEditName(topic.name)
      setIsEditingName(true)
    })
    editInputRef.current?.select()
  }

  async function commitEditName() {
    if (!canEdit) {
      setIsEditingName(false)
      return
    }
    const name = editName.trim()
    setIsEditingName(false)
    if (!name || name === topic.name) return
    try {
      unwrapResult(await topicRepo.update(topic.id, { name }))
      refresh()
    } catch (err) {
      console.error('トピック名の更新に失敗しました', err)
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEditName().catch(console.error)
    if (e.key === 'Escape') setIsEditingName(false)
  }

  async function handleDelete() {
    if (!canEdit) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      unwrapResult(await topicRepo.delete(topic.id))
      refresh()
      setIsConfirmOpen(false)
    } catch {
      setDeleteError('削除に失敗しました。再試行してください。')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!canEdit || reorderingRef.current) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromIndex = displayedTasks.findIndex((t) => t.id === active.id)
    const toIndex = displayedTasks.findIndex((t) => t.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return

    const normalizedTasks = displayedTasks.map((task, order) => ({ ...task, order }))
    const reordered = moveCompletedTasksToEnd(
      reorderItems(normalizedTasks, fromIndex, toIndex)
    ).map((task, order) => ({ ...task, order }))
    if (reordered.every((task, index) => task.id === displayedTasks[index]?.id)) return
    setPendingTaskOrder(reordered.map((task) => task.id))
    reorderingRef.current = true
    setIsReordering(true)
    try {
      const results = await Promise.allSettled(
        reordered.map((task) => taskRepo.update(task.id, { order: task.order }).then(unwrapResult))
      )
      const rejected = results.find((result) => result.status === 'rejected')
      if (rejected) throw rejected.reason
      refresh()
    } catch (err) {
      console.error('タスクの並び替えに失敗しました', err)
      setPendingTaskOrder(null)
      refresh()
    } finally {
      reorderingRef.current = false
      setIsReordering(false)
    }
  }

  return (
    <section className="group rounded-md border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border/70 px-3 py-2">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex shrink-0 items-center rounded-md p-1 hover:bg-accent/50"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        {isEditingName ? (
          <input
            ref={editInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => commitEditName().catch(console.error)}
            onKeyDown={handleEditKeyDown}
            className="flex-1 rounded-md border border-input bg-background px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            className="flex flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold hover:bg-accent/50 text-left"
            onClick={() => setIsOpen((v) => !v)}
            onDoubleClick={canEdit ? startEditingName : undefined}
          >
            <span>{topic.name}</span>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </button>
        )}
        {canEdit && (
          <>
            <button
              onClick={() => onAddTask(topic.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              title="タスクを追加"
              aria-label={`${topic.name} にタスクを追加`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={startEditingName}
              className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-accent/40 hover:text-foreground transition-opacity"
              title="トピック名を編集"
              aria-label={`${topic.name} を編集`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setDeleteError(null)
                setIsConfirmOpen(true)
              }}
              className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-accent/40 hover:text-destructive transition-opacity"
              title="トピックを削除"
              aria-label={`${topic.name} を削除`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <Dialog.Root
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setIsConfirmOpen(false)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none">
            <div className="mb-4">
              <Dialog.Title className="font-semibold mb-2">トピックを削除</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                「{topic.name}」と配下のタスク（{tasks.length}
                件）を削除します。この操作は元に戻せません。
              </Dialog.Description>
            </div>
            {deleteError && (
              <p role="alert" className="text-sm text-destructive mb-2">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isDeleting}
              >
                キャンセル
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? '削除中...' : '削除する'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {isOpen && (
        <div className={cn('py-1', tasks.length === 0 && 'py-2')}>
          {tasks.length === 0 && (
            <p className="px-5 py-2 text-xs text-muted-foreground">
              {isFiltering ? 'フィルタに一致するタスクがありません' : 'タスクがありません'}
            </p>
          )}
          {tasks.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {displayedTasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    disabled={isFiltering || !canEdit || isReordering}
                    canEdit={canEdit}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </section>
  )
}
