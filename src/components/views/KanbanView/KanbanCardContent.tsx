import { memo } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue } from '@/utils/dateUtils'
import { PRIORITY_BADGE_CLASSES, PRIORITY_LABELS } from '@/utils/taskPresentation'
import type { Task } from '@/types'

interface KanbanCardContentProps {
  task: Task
  className?: string
}

export const KanbanCardContent = memo(function KanbanCardContent({
  task,
  className,
}: KanbanCardContentProps) {
  const overdue = task.status !== 'done' && isOverdue(task.dueDate)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3 shadow-sm',
        'transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight',
            PRIORITY_BADGE_CLASSES[task.priority]
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
        <p className="font-soft line-clamp-2 flex-1 text-[15px] font-semibold leading-snug">
          {task.title}
        </p>
      </div>

      {task.dueDate && (
        <div className="mt-2 flex justify-end">
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'text-danger' : 'text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3 shrink-0" />
            {formatDate(task.dueDate)}
          </span>
        </div>
      )}
    </div>
  )
})
