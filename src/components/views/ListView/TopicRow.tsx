import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
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
import { SortableTaskRow } from '@/components/task/SortableTaskRow'
import { useFilteredTasksByTopic } from '@/hooks/useFilteredTasks'
import { useFilterStore, selectIsFiltering } from '@/store/filterStore'
import { taskRepo } from '@/repositories'
import { reorderItems } from '@/utils/sortUtils'
import type { Topic } from '@/types'

interface TopicRowProps {
  topic: Topic
  onAddTask: (topicId: string) => void
}

export function TopicRow({ topic, onAddTask }: TopicRowProps) {
  const [isOpen, setIsOpen] = useState(true)
  const tasks = useFilteredTasksByTopic(topic.id)
  const isFiltering = useFilterStore(selectIsFiltering)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
    <div>
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
      </div>

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
