import type { TaskStatus } from '@/types'

export const COLUMN_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

// 0 = 制限なし
export const WIP_LIMITS: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 5,
  done: 0,
}

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
}

export const COLUMN_COLORS: Record<TaskStatus, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-[hsl(var(--priority-medium))]',
  done: 'text-primary',
}

export const COLUMN_ACCENT_CLASSES: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-amber-400',
  done: 'bg-blue-500',
}
