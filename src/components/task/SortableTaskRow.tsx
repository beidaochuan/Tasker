import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/utils/cn'
import { TaskRow } from './TaskRow'
import type { Task } from '@/types'

interface SortableTaskRowProps {
  task: Task
  disabled?: boolean
}

export function SortableTaskRow({ task, disabled }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group/sortable flex items-center', isDragging && 'opacity-50')}
    >
      {/* disabled 時は visibility:hidden で幅を確保しレイアウトずれを防ぐ */}
      <button
        {...(disabled ? {} : { ...attributes, ...listeners })}
        className={cn(
          'flex h-9 shrink-0 touch-none items-center px-2 text-muted-foreground transition-opacity',
          disabled
            ? 'invisible'
            : 'cursor-grab opacity-0 group-hover/sortable:opacity-100 active:cursor-grabbing'
        )}
        tabIndex={-1}
        aria-label="ドラッグして並べ替え"
        aria-hidden={disabled}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1">
        <TaskRow task={task} />
      </div>
    </div>
  )
}
