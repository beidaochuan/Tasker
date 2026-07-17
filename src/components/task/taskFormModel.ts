import { z } from 'zod'
import type { Task } from '@/types'
import { formatDateInput, parseDateInput } from '@/utils/dateUtils'
import { buildRRule, parseRRule } from '@/utils/recurrenceUtils'

const dateTextSchema = z
  .string()
  .refine((value) => value.trim() === '' || parseDateInput(value) !== null, {
    message: '日付を正しく入力してください',
  })

export const taskFormSchema = z
  .object({
    title: z.string().min(1, 'タイトルは必須です'),
    projectId: z.string().min(1, 'プロジェクトを選択してください'),
    topicId: z.string().min(1, 'トピックを選択してください'),
    description: z.string(),
    status: z.enum(['todo', 'in_progress', 'done'] as const),
    priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
    startDate: dateTextSchema,
    dueDate: dateTextSchema,
    repeatEnabled: z.boolean(),
    repeatFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const),
    repeatInterval: z.coerce.number().int().min(1).max(99),
  })
  .superRefine((values, ctx) => {
    const startDate = parseDateInput(values.startDate)
    const dueDate = parseDateInput(values.dueDate)
    if (startDate && dueDate && startDate.getTime() > dueDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: '期日は開始日以降にしてください',
      })
    }
  })

export type TaskFormValues = z.infer<typeof taskFormSchema>

export function createEmptyTaskFormValues(): TaskFormValues {
  return {
    title: '',
    projectId: '',
    topicId: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    repeatEnabled: false,
    repeatFreq: 'DAILY',
    repeatInterval: 1,
  }
}

export function createNewTaskFormValues(
  projectId: string | null,
  topicId: string | null,
  today = new Date()
): TaskFormValues {
  const defaultDate = formatDateInput(today)
  return {
    ...createEmptyTaskFormValues(),
    projectId: projectId ?? '',
    topicId: topicId ?? '',
    startDate: defaultDate,
    dueDate: defaultDate,
  }
}

export function createExistingTaskFormValues(task: Task, projectId: string | null): TaskFormValues {
  const recurrence = parseRRule(task.repeatRule)
  return {
    title: task.title,
    projectId: projectId ?? '',
    topicId: task.topicId,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startDate: formatDateInput(task.startDate),
    dueDate: formatDateInput(task.dueDate),
    repeatEnabled: recurrence !== null,
    repeatFreq: recurrence?.freq ?? 'DAILY',
    repeatInterval: recurrence?.interval ?? 1,
  }
}

export function repeatRuleFromFormValues(values: TaskFormValues): string | null {
  if (!values.repeatEnabled) return null
  return buildRRule({ freq: values.repeatFreq, interval: values.repeatInterval })
}
