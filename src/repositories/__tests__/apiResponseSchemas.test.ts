import { describe, expect, it } from 'vitest'
import {
  completeRecurringResponseSchema,
  completionResponseSchema,
  projectResponseSchema,
  projectsWireResponseSchema,
  projectsResponseSchema,
  subtaskResponseSchema,
  tagResponseSchema,
  taskResponseSchema,
  tasksWireResponseSchema,
  tasksResponseSchema,
  topicResponseSchema,
} from '../apiResponseSchemas'

const RAW_PROJECT = {
  id: 'project-1',
  name: 'Project',
  description: 'Description',
  color: '#6366f1',
  status: 'active',
  isArchived: 0,
  createdAt: 1_000,
  updatedAt: 2_000,
}

const RAW_TOPIC = {
  id: 'topic-1',
  projectId: 'project-1',
  name: 'Topic',
  order: 0,
  createdAt: 3_000,
}

const RAW_TASK = {
  id: 'task-1',
  topicId: 'topic-1',
  title: 'Task',
  description: 'Description',
  status: 'in_progress',
  priority: 'high',
  dueDate: 4_000,
  startDate: 3_500,
  order: 1,
  ganttOrder: 2,
  tags: ['tag-1'],
  repeatRule: 'RRULE:FREQ=DAILY',
  statusChangedAt: 4_500,
  createdAt: 3_000,
  updatedAt: 5_000,
}

const RAW_SUBTASK = {
  id: 'subtask-1',
  taskId: 'task-1',
  title: 'Subtask',
  isDone: 1,
  order: 0,
  createdAt: 6_000,
}

const RAW_TAG = {
  id: 'tag-1',
  name: 'Tag',
  color: '#ef4444',
}

const RAW_COMPLETION = {
  id: 'completion-1',
  taskId: 'task-1',
  completedAt: 7_000,
}

describe('API response schemas', () => {
  it('Projectを検証してDateとSQLite booleanをdomain型へ変換する', () => {
    const project = projectResponseSchema.parse(RAW_PROJECT)

    expect(project).toEqual({
      ...RAW_PROJECT,
      isArchived: false,
      createdAt: new Date(1_000),
      updatedAt: new Date(2_000),
    })
  })

  it('Topicを検証してcreatedAtをDateへ変換する', () => {
    const topic = topicResponseSchema.parse(RAW_TOPIC)

    expect(topic).toEqual({
      ...RAW_TOPIC,
      createdAt: new Date(3_000),
    })
  })

  it('Taskの日時、nullable値、enum、配列をdomain型へ変換する', () => {
    const task = taskResponseSchema.parse(RAW_TASK)

    expect(task).toEqual({
      ...RAW_TASK,
      dueDate: new Date(4_000),
      startDate: new Date(3_500),
      statusChangedAt: new Date(4_500),
      createdAt: new Date(3_000),
      updatedAt: new Date(5_000),
    })

    const nullableTask = taskResponseSchema.parse({
      ...RAW_TASK,
      dueDate: null,
      startDate: null,
      ganttOrder: null,
      repeatRule: null,
    })
    expect(nullableTask).toEqual(
      expect.objectContaining({
        dueDate: null,
        startDate: null,
        ganttOrder: null,
        repeatRule: null,
      })
    )
  })

  it.each([
    ['欠落', undefined],
    ['null', null],
  ])('TaskのstatusChangedAtが%sならupdatedAtへフォールバックする', (_label, value) => {
    const raw = { ...RAW_TASK, statusChangedAt: value }
    if (value === undefined) delete raw.statusChangedAt

    const task = taskResponseSchema.parse(raw)

    expect(task.statusChangedAt).toEqual(new Date(RAW_TASK.updatedAt))
  })

  it('TaskのganttOrder欠落をnullへ正規化する', () => {
    const raw = { ...RAW_TASK, ganttOrder: undefined }
    delete raw.ganttOrder

    expect(taskResponseSchema.parse(raw).ganttOrder).toBeNull()
  })

  it('Subtaskを検証してSQLite booleanと日時を変換する', () => {
    expect(subtaskResponseSchema.parse(RAW_SUBTASK)).toEqual({
      ...RAW_SUBTASK,
      isDone: true,
      createdAt: new Date(6_000),
    })
  })

  it('Tagを検証してdomain型として返す', () => {
    expect(tagResponseSchema.parse(RAW_TAG)).toEqual(RAW_TAG)
  })

  it('Completionを検証してcompletedAtをDateへ変換する', () => {
    expect(completionResponseSchema.parse(RAW_COMPLETION)).toEqual({
      ...RAW_COMPLETION,
      completedAt: new Date(7_000),
    })
  })

  it('定期タスク完了の複合payloadをネストごとに検証・変換する', () => {
    const result = completeRecurringResponseSchema.parse({
      task: { ...RAW_TASK, status: 'done' },
      completion: RAW_COMPLETION,
      nextTask: { ...RAW_TASK, id: 'task-next', status: 'todo' },
    })

    expect(result.task.status).toBe('done')
    expect(result.task.updatedAt).toEqual(new Date(RAW_TASK.updatedAt))
    expect(result.completion.completedAt).toEqual(new Date(RAW_COMPLETION.completedAt))
    expect(result.nextTask).toEqual(
      expect.objectContaining({ id: 'task-next', status: 'todo', dueDate: new Date(4_000) })
    )

    expect(
      completeRecurringResponseSchema.parse({
        task: RAW_TASK,
        completion: RAW_COMPLETION,
        nextTask: null,
      }).nextTask
    ).toBeNull()
  })

  it.each([
    ['Project status', projectResponseSchema, { ...RAW_PROJECT, status: 'unknown' }],
    ['Topic order type', topicResponseSchema, { ...RAW_TOPIC, order: '0' }],
    ['Task status', taskResponseSchema, { ...RAW_TASK, status: 'finished' }],
    ['Task priority', taskResponseSchema, { ...RAW_TASK, priority: 'normal' }],
    ['Completion timestamp', completionResponseSchema, { ...RAW_COMPLETION, completedAt: -1 }],
    ['Project SQLite boolean', projectResponseSchema, { ...RAW_PROJECT, isArchived: 2 }],
    ['Subtask SQLite boolean', subtaskResponseSchema, { ...RAW_SUBTASK, isDone: true }],
  ])('%sがwire契約と異なる場合は拒否する', (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })

  it('一覧内の1件でも壊れていれば配列全体を拒否する', () => {
    expect(
      tasksResponseSchema.safeParse([
        RAW_TASK,
        { ...RAW_TASK, id: 'task-broken', tags: ['tag-1', 2] },
      ]).success
    ).toBe(false)

    expect(
      projectsResponseSchema.safeParse([RAW_PROJECT, { ...RAW_PROJECT, id: 10 }]).success
    ).toBe(false)
  })

  it('domainレスポンスでは未知フィールドを除去する', () => {
    const project = projectResponseSchema.parse({ ...RAW_PROJECT, futureField: 'future' })

    expect(project).not.toHaveProperty('futureField')
  })

  it('バックアップ用wireスキーマでは未知フィールドとwire表現を維持する', () => {
    const [project] = projectsWireResponseSchema.parse([
      { ...RAW_PROJECT, futureField: { enabled: true } },
    ])

    expect(project).toEqual({ ...RAW_PROJECT, futureField: { enabled: true } })
    expect(project.createdAt).toBe(1_000)
    expect(project.isArchived).toBe(0)

    const [legacyTask] = tasksWireResponseSchema.parse([
      { ...RAW_TASK, ganttOrder: undefined, statusChangedAt: null, futureField: 'future' },
    ])
    expect(legacyTask).toEqual({
      ...RAW_TASK,
      ganttOrder: null,
      statusChangedAt: RAW_TASK.updatedAt,
      futureField: 'future',
    })
  })
})
