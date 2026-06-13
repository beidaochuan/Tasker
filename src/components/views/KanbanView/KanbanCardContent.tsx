import { memo } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue, isDueToday } from '@/utils/dateUtils'
import {
  PRIORITY_DOT_CLASSES,
  PRIORITY_LABELS,
  PRIORITY_TEXT_CLASSES,
} from '@/utils/taskPresentation'
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
  const today = task.status !== 'done' && isDueToday(task.dueDate)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3 shadow-xs',
        'hover:border-primary/40 hover:bg-accent/20 transition-colors',
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
            PRIORITY_DOT_CLASSES[task.priority]
          )}
          title={PRIORITY_LABELS[task.priority]}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium',
            PRIORITY_TEXT_CLASSES[task.priority]
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue
                ? 'text-destructive'
                : today
                  ? 'text-[hsl(var(--priority-high))]'
                  : 'text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3 shrink-0" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
})
