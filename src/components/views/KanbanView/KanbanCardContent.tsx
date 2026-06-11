import { Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue, isDueToday } from '@/utils/dateUtils'
import type { Priority, Task } from '@/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-[hsl(var(--priority-low))]',
  medium: 'bg-[hsl(var(--priority-medium))]',
  high: 'bg-[hsl(var(--priority-high))]',
  urgent: 'bg-[hsl(var(--priority-urgent))]',
}

interface KanbanCardContentProps {
  task: Task
  className?: string
}

export function KanbanCardContent({ task, className }: KanbanCardContentProps) {
  const overdue = task.status !== 'done' && isOverdue(task.dueDate)
  const today = task.status !== 'done' && isDueToday(task.dueDate)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3 shadow-sm',
        'hover:border-primary/40 hover:shadow-md transition-all',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_COLORS[task.priority])}
          title={task.priority}
        />
        <p className="flex-1 text-sm leading-snug line-clamp-3">{task.title}</p>
      </div>

      {task.dueDate && (
        <div
          className={cn(
            'mt-2 flex items-center gap-1 text-xs',
            overdue
              ? 'text-destructive'
              : today
                ? 'text-[hsl(var(--priority-high))]'
                : 'text-muted-foreground'
          )}
        >
          <Clock className="h-3 w-3 shrink-0" />
          {formatDate(task.dueDate)}
        </div>
      )}
    </div>
  )
}
