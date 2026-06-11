import type { TaskStatus } from '@/types'

export const COLUMN_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled']

// 0 = 制限なし
export const WIP_LIMITS: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 5,
  done: 0,
  cancelled: 0,
}

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
  cancelled: 'キャンセル',
}

export const COLUMN_COLORS: Record<TaskStatus, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-[hsl(var(--priority-medium))]',
  done: 'text-primary',
  cancelled: 'text-muted-foreground/60',
}
