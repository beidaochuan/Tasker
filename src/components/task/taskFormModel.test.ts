import { describe, expect, it } from 'vitest'
import type { Task } from '@/types'
import { buildRRule } from '@/utils/recurrenceUtils'
import {
  createEmptyTaskFormValues,
  createExistingTaskFormValues,
  createNewTaskFormValues,
  repeatRuleFromFormValues,
  taskFormSchema,
} from './taskFormModel'

const TASK: Task = {
  id: 'task-1',
  topicId: 'topic-1',
  title: '既存タスク',
  description: '説明',
  status: 'in_progress',
  priority: 'high',
  startDate: new Date(2026, 6, 10),
  dueDate: new Date(2026, 6, 17),
  order: 1,
  tags: [],
  repeatRule: buildRRule({ freq: 'WEEKLY', interval: 2 }),
  createdAt: new Date(2026, 6, 1),
  updatedAt: new Date(2026, 6, 2),
}

describe('taskFormModel', () => {
  it('新規タスク用の所属と日付を初期化する', () => {
    expect(createNewTaskFormValues('project-1', 'topic-1', new Date(2026, 6, 17))).toMatchObject({
      projectId: 'project-1',
      topicId: 'topic-1',
      startDate: '2026-07-17',
      dueDate: '2026-07-17',
      status: 'todo',
      priority: 'medium',
    })
  })

  it('既存タスクを繰り返し設定を含むフォーム値へ変換する', () => {
    expect(createExistingTaskFormValues(TASK, 'project-1')).toEqual({
      title: '既存タスク',
      projectId: 'project-1',
      topicId: 'topic-1',
      description: '説明',
      status: 'in_progress',
      priority: 'high',
      startDate: '2026-07-10',
      dueDate: '2026-07-17',
      repeatEnabled: true,
      repeatFreq: 'WEEKLY',
      repeatInterval: 2,
    })
  })

  it('不正な日付と開始日より前の期日を拒否する', () => {
    const base = {
      ...createEmptyTaskFormValues(),
      title: 'タスク',
      projectId: 'project-1',
      topicId: 'topic-1',
    }

    expect(taskFormSchema.safeParse({ ...base, startDate: 'not-a-date' }).success).toBe(false)
    const result = taskFormSchema.safeParse({
      ...base,
      startDate: '2026-07-18',
      dueDate: '2026-07-17',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['dueDate'], message: '期日は開始日以降にしてください' }),
        ])
      )
    }
  })

  it('フォームの有効状態から繰り返しルールを生成する', () => {
    const values = {
      ...createEmptyTaskFormValues(),
      repeatEnabled: true,
      repeatFreq: 'MONTHLY' as const,
      repeatInterval: 3,
    }

    expect(repeatRuleFromFormValues(values)).toContain('FREQ=MONTHLY;INTERVAL=3')
    expect(repeatRuleFromFormValues({ ...values, repeatEnabled: false })).toBeNull()
  })
})
