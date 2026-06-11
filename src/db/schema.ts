import Dexie, { type EntityTable } from 'dexie'
import type { Project, Topic, Task, Subtask, Tag, TaskCompletion } from '@/types'

// DB 保存用の型（日付は Unix ms 整数、tags は JSON 文字列配列）
export interface ProjectRow extends Omit<Project, 'isArchived' | 'createdAt' | 'updatedAt'> {
  isArchived: 0 | 1
  createdAt: number
  updatedAt: number
}

export interface TopicRow extends Omit<Topic, 'createdAt'> {
  createdAt: number
}

export interface TaskRow extends Omit<Task, 'dueDate' | 'startDate' | 'createdAt' | 'updatedAt'> {
  dueDate: number | null
  startDate: number | null
  createdAt: number
  updatedAt: number
}

export interface SubtaskRow extends Omit<Subtask, 'isDone' | 'createdAt'> {
  isDone: 0 | 1
  createdAt: number
}

export type TagRow = Tag

export interface TaskCompletionRow extends Omit<TaskCompletion, 'completedAt'> {
  completedAt: number
}

export class TaskerDB extends Dexie {
  projects!: EntityTable<ProjectRow, 'id'>
  topics!: EntityTable<TopicRow, 'id'>
  tasks!: EntityTable<TaskRow, 'id'>
  subtasks!: EntityTable<SubtaskRow, 'id'>
  tags!: EntityTable<TagRow, 'id'>
  task_completions!: EntityTable<TaskCompletionRow, 'id'>

  constructor(indexedDB?: IDBFactory) {
    super('TaskerDB', { indexedDB })
    this.version(1).stores({
      projects: 'id, status, isArchived, createdAt',
      topics: 'id, projectId, order',
      tasks: 'id, topicId, status, priority, dueDate, startDate, order, createdAt',
      subtasks: 'id, taskId, isDone, order',
      tags: 'id, name',
      task_completions: 'id, taskId, completedAt',
    })
    // v2: tasks に *tags マルチエントリインデックスを追加（タグフィルタ用）
    this.version(2).stores({
      tasks: 'id, topicId, status, priority, dueDate, startDate, order, createdAt, *tags',
    })
  }
}

export const db = new TaskerDB()
