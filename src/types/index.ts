export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
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
  tags: string[]
  repeatRule: string | null
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
  | { code: 'DB_ERROR'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
