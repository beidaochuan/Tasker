import { Check, Circle, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue, isDueToday } from '@/utils/dateUtils'
import { useUIStore } from '@/store/uiStore'
import { taskRepo } from '@/repositories'
import type { Task } from '@/types'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[hsl(var(--priority-low))]',
  medium: 'bg-[hsl(var(--priority-medium))]',
  high: 'bg-[hsl(var(--priority-high))]',
  urgent: 'bg-[hsl(var(--priority-urgent))]',
}

interface TaskRowProps {
  task: Task
}

export function TaskRow({ task }: TaskRowProps) {
  const { openTaskDrawer } = useUIStore()
  const isDone = task.status === 'done'

  async function toggleDone(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await taskRepo.update(task.id, { status: isDone ? 'todo' : 'done' })
    } catch (err) {
      console.error('ステータス更新に失敗しました', err)
    }
  }

  const overdue = !isDone && isOverdue(task.dueDate)
  const today = !isDone && isDueToday(task.dueDate)

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/40"
      onClick={() => openTaskDrawer(task.id)}
    >
      <button
        onClick={toggleDone}
        className="shrink-0 text-muted-foreground hover:text-primary"
        title={isDone ? '未完了に戻す' : '完了にする'}
      >
        {isDone ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
      </button>

      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_COLORS[task.priority])}
        title={task.priority}
      />

      <span
        className={cn('flex-1 truncate text-sm', isDone && 'line-through text-muted-foreground')}
      >
        {task.title}
      </span>

      {task.dueDate && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-0.5 text-xs',
            overdue
              ? 'text-destructive'
              : today
                ? 'text-[hsl(var(--priority-high))]'
                : 'text-muted-foreground'
          )}
        >
          <Clock className="h-3 w-3" />
          {formatDate(task.dueDate)}
        </span>
      )}

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}
