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
