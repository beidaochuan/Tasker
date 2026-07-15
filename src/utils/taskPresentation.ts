import type { Priority, TaskStatus } from '@/types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
}

export const STATUS_TEXT_CLASSES: Record<TaskStatus, string> = {
  todo: 'text-slate-600 dark:text-slate-300',
  in_progress: 'text-blue-600 dark:text-blue-400',
  done: 'text-emerald-600 dark:text-emerald-400',
}

export const STATUS_BACKGROUND_CLASSES: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: '緊急',
  high: '高',
  medium: '中',
  low: '低',
}

export const PRIORITY_DOT_CLASSES: Record<Priority, string> = {
  low: 'bg-[hsl(var(--priority-low))]',
  medium: 'bg-[hsl(var(--priority-medium))]',
  high: 'bg-[hsl(var(--priority-high))]',
  urgent: 'bg-[hsl(var(--priority-urgent))]',
}

export const PRIORITY_TEXT_CLASSES: Record<Priority, string> = {
  low: 'text-[hsl(var(--priority-low))]',
  medium: 'text-[hsl(var(--priority-medium))]',
  high: 'text-[hsl(var(--priority-high))]',
  urgent: 'text-[hsl(var(--priority-urgent))]',
}

export const PRIORITY_BADGE_CLASSES: Record<Priority, string> = {
  low: 'bg-emerald-500/15 text-[hsl(var(--priority-low))]',
  medium: 'bg-amber-500/15 text-[hsl(var(--priority-medium))]',
  high: 'bg-orange-500/15 text-[hsl(var(--priority-high))]',
  urgent: 'bg-rose-500/15 text-[hsl(var(--priority-urgent))]',
}
