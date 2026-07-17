export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Project {
  id: string
  name: string
  description: string
  color: string
  status: ProjectStatus
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Topic {
  id: string
  projectId: string
  name: string
  order: number
  createdAt: Date
}

export interface Task {
  id: string
  topicId: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: Date | null
  startDate: Date | null
  order: number
  /** ガントで手動並び替えした場合のみ設定される専用順序 */
  ganttOrder?: number | null
  tags: string[]
  repeatRule: string | null
  /** 現在のステータスへ変更された日時（旧データでは updatedAt を使用） */
  statusChangedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Subtask {
  id: string
  taskId: string
  title: string
  isDone: boolean
  order: number
  createdAt: Date
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface TaskCompletion {
  id: string
  taskId: string
  completedAt: Date
}

export type AppError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'INVALID_RESPONSE'; message: string }

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
