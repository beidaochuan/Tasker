import { describe, expect, it } from 'vitest'
import type { Task, Topic } from '@/types'
import {
  applyGanttPreview,
  applyGanttTaskOrder,
  projectGanttRows,
  type GanttFlatRow,
} from './ganttRowModel'

function makeTopic(id: string, name = id): Topic {
  return {
    id,
    projectId: 'project-1',
    name,
    order: 0,
    createdAt: new Date('2026-01-01'),
  }
}

function makeTask(id: string, topicId: string, status: Task['status'] = 'todo'): Task {
  return {
    id,
    topicId,
    title: id,
    description: '',
    status,
    priority: 'medium',
    dueDate: new Date('2026-01-10'),
    startDate: new Date('2026-01-08'),
    order: 0,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function rowKeys(rows: readonly GanttFlatRow[]): string[] {
  return rows.map((row) => (row.type === 'task-row' ? row.task.id : `${row.type}:${row.topicId}`))
}

describe('projectGanttRows', () => {
  it('完了タスクを折り畳み、全行と表示範囲には必要な行だけを残す', () => {
    const topic = makeTopic('topic-1', '開発')
    const doneA = makeTask('done-a', topic.id, 'done')
    const active = makeTask('active', topic.id)
    const doneB = makeTask('done-b', topic.id, 'done')

    const projected = projectGanttRows([{ topic, tasks: [doneA, active, doneB] }], {})

    expect(rowKeys(projected.allRows)).toEqual(['topic:topic-1', 'active', 'done-a', 'done-b'])
    expect(rowKeys(projected.visibleRows)).toEqual([
      'topic:topic-1',
      'active',
      'completed-group:topic-1',
    ])
    expect(projected.visibleRows[2]).toMatchObject({
      type: 'completed-group',
      label: '完了タスク（2）',
      completedCount: 2,
    })
    expect(projected.rangeRows).toEqual([{ topic, tasks: [active] }])
  })

  it('展開中のトピックだけ完了タスクと表示範囲を復元する', () => {
    const topicA = makeTopic('topic-a')
    const topicB = makeTopic('topic-b')
    const activeA = makeTask('active-a', topicA.id)
    const doneA = makeTask('done-a', topicA.id, 'done')
    const activeB = makeTask('active-b', topicB.id)
    const doneB = makeTask('done-b', topicB.id, 'done')

    const projected = projectGanttRows(
      [
        { topic: topicA, tasks: [doneA, activeA] },
        { topic: topicB, tasks: [activeB, doneB] },
      ],
      { [topicA.id]: true }
    )

    expect(rowKeys(projected.visibleRows)).toEqual([
      'topic:topic-a',
      'active-a',
      'completed-group:topic-a',
      'done-a',
      'topic:topic-b',
      'active-b',
      'completed-group:topic-b',
    ])
    // rangeRows は元データの相対順序を保つ。
    expect(projected.rangeRows).toEqual([
      { topic: topicA, tasks: [doneA, activeA] },
      { topic: topicB, tasks: [activeB] },
    ])
  })

  it('完了タスクが0件なら完了グループを作らない', () => {
    const topic = makeTopic('topic-1')
    const task = makeTask('active', topic.id)

    const projected = projectGanttRows([{ topic, tasks: [task] }], { [topic.id]: true })

    expect(projected.visibleRows.some((row) => row.type === 'completed-group')).toBe(false)
    expect(rowKeys(projected.visibleRows)).toEqual(['topic:topic-1', 'active'])
  })

  it('入力の配列とTask参照を変更しない', () => {
    const topic = makeTopic('topic-1')
    const done = makeTask('done', topic.id, 'done')
    const active = makeTask('active', topic.id)
    const tasks = Object.freeze([done, active])
    const source = Object.freeze([{ topic, tasks }])

    const projected = projectGanttRows(source, { [topic.id]: true })
    const projectedTasks = projected.allRows.filter((row) => row.type === 'task-row')

    expect(tasks).toEqual([done, active])
    expect(projectedTasks.map((row) => row.task)).toEqual([active, done])
    expect(projectedTasks[0].task).toBe(active)
    expect(projectedTasks[1].task).toBe(done)
  })

  it('繰り返し展開タスクの仮想IDをそのまま保つ', () => {
    const topic = makeTopic('topic-1')
    const virtualTask = makeTask('task-1_1781136000000', topic.id)

    const projected = projectGanttRows([{ topic, tasks: [virtualTask] }], {})
    const taskRow = projected.visibleRows.find((row) => row.type === 'task-row')

    expect(taskRow?.task).toBe(virtualTask)
    expect(taskRow?.task.id).toBe('task-1_1781136000000')
  })
})

describe('Gantt行の楽観的表示', () => {
  it('指定トピックのタスク行だけを並び替える', () => {
    const topicA = makeTopic('topic-a')
    const topicB = makeTopic('topic-b')
    const taskA = makeTask('task-a', topicA.id)
    const taskB = makeTask('task-b', topicA.id)
    const taskC = makeTask('task-c', topicB.id)
    const { visibleRows } = projectGanttRows(
      [
        { topic: topicA, tasks: [taskA, taskB] },
        { topic: topicB, tasks: [taskC] },
      ],
      {}
    )

    const ordered = applyGanttTaskOrder(visibleRows, {
      topicId: topicA.id,
      taskIds: [taskB.id, taskA.id],
    })

    expect(rowKeys(ordered)).toEqual([
      'topic:topic-a',
      'task-b',
      'task-a',
      'topic:topic-b',
      'task-c',
    ])
    expect(rowKeys(visibleRows)).toEqual([
      'topic:topic-a',
      'task-a',
      'task-b',
      'topic:topic-b',
      'task-c',
    ])
  })

  it('preview日付を対象タスクにだけ適用し、元タスクを変更しない', () => {
    const topic = makeTopic('topic-1')
    const taskA = makeTask('task-a', topic.id)
    const taskB = makeTask('task-b', topic.id)
    const { visibleRows } = projectGanttRows([{ topic, tasks: [taskA, taskB] }], {})
    const previewDates = {
      startDate: new Date('2026-02-01'),
      dueDate: new Date('2026-02-05'),
    }

    const displayed = applyGanttPreview(visibleRows, new Map([[taskA.id, previewDates]]))
    const displayedTasks = displayed.filter((row) => row.type === 'task-row')

    expect(displayedTasks[0].task).not.toBe(taskA)
    expect(displayedTasks[0].task).toMatchObject(previewDates)
    expect(displayedTasks[1].task).toBe(taskB)
    expect(taskA.startDate).toEqual(new Date('2026-01-08'))
    expect(taskA.dueDate).toEqual(new Date('2026-01-10'))
  })
})
