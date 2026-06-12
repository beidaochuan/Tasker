import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
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
import { taskRepo } from '@/repositories'
import { db } from '@/db/schema'
import { reorderItems } from '@/utils/sortUtils'
import type { Topic } from '@/types'

interface TopicRowProps {
  topic: Topic
  onAddTask: (topicId: string) => void
}

export function TopicRow({ topic, onAddTask }: TopicRowProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const tasks = useFilteredTasksByTopic(topic.id)
  const isFiltering = useFilterStore(selectIsFiltering)
  const dialogTitleId = `delete-topic-title-${topic.id}`

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await db.transaction(
        'rw',
        db.tasks,
        db.subtasks,
        db.task_completions,
        db.topics,
        async () => {
          const taskIds = await db.tasks.where('topicId').equals(topic.id).primaryKeys()
          await db.subtasks
            .where('taskId')
            .anyOf(taskIds as string[])
            .delete()
          await db.task_completions
            .where('taskId')
            .anyOf(taskIds as string[])
            .delete()
          await db.tasks.bulkDelete(taskIds as string[])
          await db.topics.delete(topic.id)
        }
      )
      setIsConfirmOpen(false)
    } catch {
      setDeleteError('削除に失敗しました。再試行してください。')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromIndex = tasks.findIndex((t) => t.id === active.id)
    const toIndex = tasks.findIndex((t) => t.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return

    const reordered = reorderItems(tasks, fromIndex, toIndex)
    await Promise.all(reordered.map((t) => taskRepo.update(t.id, { order: t.order })))
  }

  return (
    <div className="group">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/40"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span>{topic.name}</span>
          <span className="ml-1 text-xs text-muted-foreground">({tasks.length})</span>
        </button>
        <button
          onClick={() => onAddTask(topic.id)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          title="タスクを追加"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            setDeleteError(null)
            setIsConfirmOpen(true)
          }}
          className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-accent/40 hover:text-destructive transition-opacity"
          title="トピックを削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!isDeleting) setIsConfirmOpen(false)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative z-10 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl"
          >
            <h2 id={dialogTitleId} className="font-semibold mb-2">
              トピックを削除
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              「{topic.name}」と配下のタスク（{tasks.length}
              件）を削除します。この操作は元に戻せません。
            </p>
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
          </div>
        </div>
      )}

      {isOpen && (
        <div className={cn('ml-4 space-y-0.5', tasks.length === 0 && 'py-1')}>
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
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map((task) => (
                  <SortableTaskRow key={task.id} task={task} disabled={isFiltering} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}
