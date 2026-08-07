import type { Priority, TaskCategory, TaskStatus } from '@/types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  paused: '一時停止',
  done: '完了',
}

export const STATUS_TEXT_CLASSES: Record<TaskStatus, string> = {
  todo: 'text-slate-600 dark:text-slate-300',
  in_progress: 'text-blue-600 dark:text-blue-400',
  paused: 'text-gray-400 dark:text-gray-500',
  done: 'text-emerald-600 dark:text-emerald-400',
}

export const STATUS_BACKGROUND_CLASSES: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-600',
  paused: 'bg-gray-300',
  done: 'bg-emerald-500',
}

export const STATUS_FOREGROUND_CLASSES: Record<TaskStatus, string> = {
  todo: 'text-foreground',
  in_progress: 'text-white',
  paused: 'text-foreground',
  done: 'text-foreground',
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

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  software: 'ソフト',
  electric: 'デンキ',
}

export const CATEGORY_BADGE_CLASSES: Record<TaskCategory, string> = {
  software: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  electric: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
}
