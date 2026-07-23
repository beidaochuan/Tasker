import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Subtask } from '@/types'
import { cn } from '@/utils/cn'

interface SortableSubtaskRowProps {
  subtask: Subtask
  disabled: boolean
  children: ReactNode
}

export function SortableSubtaskRow({ subtask, disabled, children }: SortableSubtaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group/sortable flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/40',
        isDragging && 'opacity-50'
      )}
    >
      <button
        type="button"
        {...(disabled ? {} : { ...attributes, ...listeners })}
        disabled={disabled}
        aria-label={`「${subtask.title}」をドラッグして並べ替え`}
        className={cn(
          'flex shrink-0 touch-none rounded-md p-1 text-muted-foreground transition-opacity',
          disabled
            ? 'invisible'
            : 'cursor-grab opacity-70 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/sortable:opacity-100 active:cursor-grabbing'
        )}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  )
}
