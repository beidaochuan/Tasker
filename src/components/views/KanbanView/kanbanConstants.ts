import { TASK_STATUSES, type TaskStatus } from '@/types'

export const COLUMN_ORDER: TaskStatus[] = [...TASK_STATUSES]

// 0 = 制限なし
export const WIP_LIMITS: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 5,
  paused: 0,
  done: 0,
}

export const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  paused: '一時停止',
  done: '完了',
}
