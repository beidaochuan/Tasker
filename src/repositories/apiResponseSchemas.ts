import { z } from 'zod'
import {
  TASK_STATUSES,
  type Project,
  type Subtask,
  type Tag,
  type Task,
  type TaskComment,
  type TaskCompletion,
  type TaskRelation,
  type Topic,
} from '@/types'
import { fromUnixMs } from '@/utils/dateUtils'

const idSchema = z.string().min(1).max(128)
const taskIdSchema = z.number().int().positive().safe()
const orderSchema = z.number().int().nonnegative().finite()
const MAX_DATE_MS = 8_640_000_000_000_000
const unixMsSchema = z.number().int().nonnegative().max(MAX_DATE_MS).finite()
const sqliteBooleanSchema = z.union([z.literal(0), z.literal(1)])

export const projectWireSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    description: z.string(),
    color: z.string(),
    status: z.enum(['active', 'on_hold', 'completed', 'archived']),
    isArchived: sqliteBooleanSchema,
    createdAt: unixMsSchema,
    updatedAt: unixMsSchema,
  })
  .strip()

export type ProjectWireDto = z.infer<typeof projectWireSchema>

export function mapProjectDto(raw: ProjectWireDto): Project {
  return {
    ...raw,
    isArchived: raw.isArchived === 1,
    createdAt: fromUnixMs(raw.createdAt),
    updatedAt: fromUnixMs(raw.updatedAt),
  }
}

export const projectResponseSchema = projectWireSchema.transform(mapProjectDto)
export const projectsResponseSchema = z.array(projectResponseSchema)

export const topicWireSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    name: z.string(),
    order: orderSchema,
    createdAt: unixMsSchema,
  })
  .strip()

export type TopicWireDto = z.infer<typeof topicWireSchema>

export function mapTopicDto(raw: TopicWireDto): Topic {
  return {
    ...raw,
    createdAt: fromUnixMs(raw.createdAt),
  }
}

export const topicResponseSchema = topicWireSchema.transform(mapTopicDto)
export const topicsResponseSchema = z.array(topicResponseSchema)

export const taskWireSchema = z
  .object({
    id: taskIdSchema,
    topicId: idSchema,
    title: z.string(),
    description: z.string(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.enum(['software', 'electric']).nullable(),
    dueDate: unixMsSchema.nullable(),
    startDate: unixMsSchema.nullable(),
    order: orderSchema,
    ganttOrder: orderSchema.nullable().optional(),
    tags: z.array(idSchema),
    repeatRule: z.string().nullable(),
    statusChangedAt: unixMsSchema.nullish(),
    createdAt: unixMsSchema,
    updatedAt: unixMsSchema,
    subtaskTotal: z.number().int().nonnegative().optional(),
    subtaskDone: z.number().int().nonnegative().optional(),
  })
  .strip()

export type TaskWireDto = z.infer<typeof taskWireSchema>

export function mapTaskDto(raw: TaskWireDto): Task {
  return {
    id: raw.id,
    topicId: raw.topicId,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    category: raw.category,
    dueDate: raw.dueDate === null ? null : fromUnixMs(raw.dueDate),
    startDate: raw.startDate === null ? null : fromUnixMs(raw.startDate),
    order: raw.order,
    ganttOrder: raw.ganttOrder ?? null,
    tags: raw.tags,
    repeatRule: raw.repeatRule,
    statusChangedAt: fromUnixMs(raw.statusChangedAt ?? raw.updatedAt),
    createdAt: fromUnixMs(raw.createdAt),
    updatedAt: fromUnixMs(raw.updatedAt),
    subtaskTotal: raw.subtaskTotal,
    subtaskDone: raw.subtaskDone,
  }
}

export const taskResponseSchema = taskWireSchema.transform(mapTaskDto)
export const tasksResponseSchema = z.array(taskResponseSchema)

export const subtaskWireSchema = z
  .object({
    id: idSchema,
    taskId: taskIdSchema,
    title: z.string(),
    isDone: sqliteBooleanSchema,
    order: orderSchema,
    createdAt: unixMsSchema,
  })
  .strip()

export type SubtaskWireDto = z.infer<typeof subtaskWireSchema>

export function mapSubtaskDto(raw: SubtaskWireDto): Subtask {
  return {
    ...raw,
    isDone: raw.isDone === 1,
    createdAt: fromUnixMs(raw.createdAt),
  }
}

export const subtaskResponseSchema = subtaskWireSchema.transform(mapSubtaskDto)
export const subtasksResponseSchema = z.array(subtaskResponseSchema)

export const tagWireSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    color: z.string(),
  })
  .strip()

export type TagWireDto = z.infer<typeof tagWireSchema>

export function mapTagDto(raw: TagWireDto): Tag {
  return raw
}

export const tagResponseSchema = tagWireSchema.transform(mapTagDto)
export const tagsResponseSchema = z.array(tagResponseSchema)

export const completionWireSchema = z
  .object({
    id: idSchema,
    taskId: taskIdSchema,
    completedAt: unixMsSchema,
  })
  .strip()

export type CompletionWireDto = z.infer<typeof completionWireSchema>

export function mapCompletionDto(raw: CompletionWireDto): TaskCompletion {
  return {
    ...raw,
    completedAt: fromUnixMs(raw.completedAt),
  }
}

export const completionResponseSchema = completionWireSchema.transform(mapCompletionDto)
export const completionsResponseSchema = z.array(completionResponseSchema)

export const commentWireSchema = z
  .object({
    id: idSchema,
    taskId: taskIdSchema,
    body: z.string(),
    createdAt: unixMsSchema,
    updatedAt: unixMsSchema,
  })
  .strip()

export type CommentWireDto = z.infer<typeof commentWireSchema>

export function mapCommentDto(raw: CommentWireDto): TaskComment {
  return {
    ...raw,
    createdAt: fromUnixMs(raw.createdAt),
    updatedAt: fromUnixMs(raw.updatedAt),
  }
}

export const commentResponseSchema = commentWireSchema.transform(mapCommentDto)
export const commentsResponseSchema = z.array(commentResponseSchema)

export const taskRelationWireSchema = z
  .object({ taskId: taskIdSchema, relatedTaskId: taskIdSchema })
  .strip()

export function mapTaskRelationDto(raw: z.infer<typeof taskRelationWireSchema>): TaskRelation {
  return raw
}

export const taskRelationsResponseSchema = z.array(
  taskRelationWireSchema.transform(mapTaskRelationDto)
)

export const completeRecurringResponseSchema = z.object({
  task: taskResponseSchema,
  completion: completionResponseSchema,
  nextTask: taskResponseSchema.nullable(),
})

// バックアップはwire表現（数値timestamp、SQLite boolean）を保ち、
// 将来追加された未知フィールドも欠落させない。
export const projectsWireResponseSchema = z.array(projectWireSchema.passthrough())
export const topicsWireResponseSchema = z.array(topicWireSchema.passthrough())
export const tasksWireResponseSchema = z.array(
  taskWireSchema.passthrough().transform((raw) => ({
    ...raw,
    ganttOrder: raw.ganttOrder ?? null,
    statusChangedAt: raw.statusChangedAt ?? raw.updatedAt,
  }))
)
export const subtasksWireResponseSchema = z.array(subtaskWireSchema.passthrough())
export const tagsWireResponseSchema = z.array(tagWireSchema.passthrough())
export const completionsWireResponseSchema = z.array(completionWireSchema.passthrough())
export const commentsWireResponseSchema = z.array(commentWireSchema.passthrough())
export const taskRelationsWireResponseSchema = z.array(taskRelationWireSchema.passthrough())
