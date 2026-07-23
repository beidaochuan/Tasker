import type {
  Project,
  Topic,
  Task,
  Subtask,
  Tag,
  TaskCompletion,
  TaskRelation,
  Result,
} from '@/types'

export type CreateProject = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateProject = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>

export type CreateTopic = Omit<Topic, 'id' | 'createdAt'>
export type UpdateTopic = Partial<Omit<Topic, 'id' | 'createdAt'>>

export type CreateTask = Omit<Task, 'id' | 'statusChangedAt' | 'createdAt' | 'updatedAt'>
export type UpdateTask = Partial<Omit<Task, 'id' | 'statusChangedAt' | 'createdAt' | 'updatedAt'>>
export interface GanttOrderUpdate {
  id: string
  ganttOrder: number
}
export type CompleteRecurringTaskResult = {
  task: Task
  completion: TaskCompletion
  nextTask: Task | null
}

export type CreateSubtask = Omit<Subtask, 'id' | 'createdAt'>
export type UpdateSubtask = Partial<Omit<Subtask, 'id' | 'createdAt'>>
export interface SubtaskOrderUpdate {
  id: string
  order: number
}

export type CreateTag = Omit<Tag, 'id'>

export interface IProjectRepository {
  getAll(): Promise<Result<Project[]>>
  getById(id: string): Promise<Result<Project>>
  create(data: CreateProject): Promise<Result<Project>>
  update(id: string, data: UpdateProject): Promise<Result<Project>>
  delete(id: string): Promise<Result<void>>
}

export interface ITopicRepository {
  getByProjectId(projectId: string): Promise<Result<Topic[]>>
  getById(id: string): Promise<Result<Topic>>
  create(data: CreateTopic): Promise<Result<Topic>>
  update(id: string, data: UpdateTopic): Promise<Result<Topic>>
  delete(id: string): Promise<Result<void>>
}

export interface ITaskRepository {
  getAll(): Promise<Result<Task[]>>
  getByTopicId(topicId: string): Promise<Result<Task[]>>
  getByProjectId(projectId: string): Promise<Result<Task[]>>
  getById(id: string): Promise<Result<Task>>
  create(data: CreateTask): Promise<Result<Task>>
  update(id: string, data: UpdateTask): Promise<Result<Task>>
  updateGanttOrder(items: GanttOrderUpdate[]): Promise<Result<void>>
  completeRecurring(
    id: string,
    nextTask: CreateTask | null
  ): Promise<Result<CompleteRecurringTaskResult>>
  getRelatedTasks(id: string): Promise<Result<Task[]>>
  replaceRelatedTasks(id: string, relatedTaskIds: string[]): Promise<Result<Task[]>>
  getRelations(): Promise<Result<TaskRelation[]>>
  delete(id: string): Promise<Result<void>>
}

export interface ISubtaskRepository {
  getByTaskId(taskId: string): Promise<Result<Subtask[]>>
  create(data: CreateSubtask): Promise<Result<Subtask>>
  update(id: string, data: UpdateSubtask): Promise<Result<Subtask>>
  updateOrder(items: SubtaskOrderUpdate[]): Promise<Result<void>>
  delete(id: string): Promise<Result<void>>
}

export interface ITagRepository {
  getAll(): Promise<Result<Tag[]>>
  create(data: CreateTag): Promise<Result<Tag>>
  delete(id: string): Promise<Result<void>>
}

export interface ITaskCompletionRepository {
  getByTaskId(taskId: string): Promise<Result<TaskCompletion[]>>
  create(taskId: string): Promise<Result<TaskCompletion>>
}
