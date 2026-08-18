import { memo } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate, getStatusChangedAt, isOverdue } from '@/utils/dateUtils'
import { calcSubtaskProgressPercent } from '@/utils/progressUtils'
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
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
  const completedAt = task.status === 'done' ? getStatusChangedAt(task) : null
  const subtaskTotal = task.subtaskTotal ?? 0
  const subtaskDone = task.subtaskDone ?? 0
  const hasSubtasks = subtaskTotal > 0
  const subtaskProgress = calcSubtaskProgressPercent(subtaskDone, subtaskTotal)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3 shadow-sm',
        'transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md',
        className
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <p
          className="shrink-0 truncate font-mono text-[10px] text-muted-foreground"
          title={String(task.id)}
        >
          ID: {task.id}
        </p>
        {hasSubtasks && (
          <>
            <div
              role="progressbar"
              aria-label="作業リストの進捗"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={subtaskProgress}
              aria-valuetext={`${subtaskDone} / ${subtaskTotal} 完了`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width]',
                  subtaskProgress >= 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {subtaskDone}/{subtaskTotal}
            </span>
          </>
        )}
      </div>

      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight',
            PRIORITY_BADGE_CLASSES[task.priority]
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.category && (
          <span
            className={cn(
              'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight',
              CATEGORY_BADGE_CLASSES[task.category]
            )}
          >
            {CATEGORY_LABELS[task.category]}
          </span>
        )}
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

      {completedAt && (
        <div className="mt-2 flex justify-end">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />
            完了: {formatDate(completedAt)}
          </span>
        </div>
      )}
    </div>
  )
})
