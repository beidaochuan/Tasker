import type { Response } from 'express'
import { z } from 'zod'

const idSchema = z.string().min(1).max(128)
const nameSchema = z.string().trim().min(1).max(200)
const titleSchema = z.string().trim().min(1).max(500)
const descriptionSchema = z.string().max(100_000)
const colorSchema = z.string().min(1).max(64)
const timestampSchema = z.number().int().nonnegative().finite()
const nullableTimestampSchema = timestampSchema.nullable()
const orderSchema = z.number().int().nonnegative().finite()
const statusSchema = z.enum(['todo', 'in_progress', 'done'])
const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
const projectStatusSchema = z.enum(['active', 'on_hold', 'completed', 'archived'])
const tagsSchema = z.array(idSchema).max(1_000)
const serializedTagsSchema = z
  .string()
  .max(100_000)
  .refine((value) => {
    try {
      return tagsSchema.safeParse(JSON.parse(value)).success
    } catch {
      return false
    }
  }, 'タグ形式が不正です')
const repeatRuleSchema = z.string().max(2_000).nullable()

const nonEmptyPatch = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: '更新項目が必要です' })

export const projectCreateSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.default(''),
    color: colorSchema.default('#6366f1'),
    status: projectStatusSchema.default('active'),
    isArchived: z.boolean().default(false),
  })
  .strict()

export const projectUpdateSchema = nonEmptyPatch({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  color: colorSchema.optional(),
  status: projectStatusSchema.optional(),
  isArchived: z.boolean().optional(),
})

export const topicCreateSchema = z
  .object({
    projectId: idSchema,
    name: nameSchema,
    order: orderSchema.default(0),
  })
  .strict()

export const topicUpdateSchema = nonEmptyPatch({
  name: nameSchema.optional(),
  order: orderSchema.optional(),
})

export const taskCreateSchema = z
  .object({
    topicId: idSchema,
    title: titleSchema,
    description: descriptionSchema.default(''),
    status: statusSchema.default('todo'),
    priority: prioritySchema.default('medium'),
    dueDate: nullableTimestampSchema.default(null),
    startDate: nullableTimestampSchema.default(null),
    order: orderSchema.default(0),
    ganttOrder: orderSchema.nullable().optional().default(null),
    tags: tagsSchema.default([]),
    repeatRule: repeatRuleSchema.default(null),
  })
  .strict()

export const taskUpdateSchema = nonEmptyPatch({
  topicId: idSchema.optional(),
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: nullableTimestampSchema.optional(),
  startDate: nullableTimestampSchema.optional(),
  order: orderSchema.optional(),
  ganttOrder: orderSchema.nullable().optional(),
  tags: tagsSchema.optional(),
  repeatRule: repeatRuleSchema.optional(),
})

export const completeRecurringSchema = z.object({ nextTask: taskCreateSchema.nullable() }).strict()

export const ganttOrderSchema = z
  .object({
    items: z
      .array(z.object({ id: idSchema, ganttOrder: orderSchema }).strict())
      .min(1)
      .max(100_000)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: 'IDが重複しています',
      }),
  })
  .strict()

export const subtaskCreateSchema = z
  .object({
    taskId: idSchema,
    title: titleSchema,
    isDone: z.boolean().default(false),
    order: orderSchema.default(0),
  })
  .strict()

export const subtaskUpdateSchema = nonEmptyPatch({
  title: titleSchema.optional(),
  isDone: z.boolean().optional(),
  order: orderSchema.optional(),
})

export const tagCreateSchema = z
  .object({ name: nameSchema, color: colorSchema.default('#6366f1') })
  .strict()

export const completionCreateSchema = z.object({ taskId: idSchema }).strict()

const sqliteBooleanSchema = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => (value ? 1 : 0))

const importedProjectSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    description: descriptionSchema,
    color: colorSchema,
    status: projectStatusSchema,
    isArchived: sqliteBooleanSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strip()

const importedTopicSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    name: nameSchema,
    order: orderSchema,
    createdAt: timestampSchema,
  })
  .strip()

const importedTaskSchema = z
  .object({
    id: idSchema,
    topicId: idSchema,
    title: titleSchema,
    description: descriptionSchema,
    status: statusSchema,
    priority: prioritySchema,
    dueDate: nullableTimestampSchema,
    startDate: nullableTimestampSchema,
    order: orderSchema,
    ganttOrder: orderSchema.nullable().optional().default(null),
    tags: z.union([tagsSchema, serializedTagsSchema]),
    repeatRule: repeatRuleSchema,
    statusChangedAt: timestampSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strip()

const importedSubtaskSchema = z
  .object({
    id: idSchema,
    taskId: idSchema,
    title: titleSchema,
    isDone: sqliteBooleanSchema,
    order: orderSchema,
    createdAt: timestampSchema,
  })
  .strip()

const importedTagSchema = z.object({ id: idSchema, name: nameSchema, color: colorSchema }).strip()

const importedCompletionSchema = z
  .object({ id: idSchema, taskId: idSchema, completedAt: timestampSchema })
  .strip()

const MAX_ROWS = 100_000

export const importSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime().optional(),
    data: z
      .object({
        projects: z.array(importedProjectSchema).max(MAX_ROWS).default([]),
        topics: z.array(importedTopicSchema).max(MAX_ROWS).default([]),
        tasks: z.array(importedTaskSchema).max(MAX_ROWS).default([]),
        subtasks: z.array(importedSubtaskSchema).max(MAX_ROWS).default([]),
        tags: z.array(importedTagSchema).max(MAX_ROWS).default([]),
        task_completions: z.array(importedCompletionSchema).max(MAX_ROWS).default([]),
      })
      .strict(),
  })
  .strict()

export function parseOrRespond<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  res: Response
): z.infer<S> | null {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  res.status(400).json({
    error: 'VALIDATION_ERROR',
    field: issue?.path.join('.') || undefined,
    message: issue?.message,
  })
  return null
}
