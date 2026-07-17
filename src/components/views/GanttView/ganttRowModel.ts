import type { Task, Topic } from '@/types'

export interface GanttSourceRow {
  topic: Topic
  tasks: readonly Task[]
}

export interface GanttTopicFlatRow {
  type: 'topic'
  label: string
  topicId: string
}

export interface GanttCompletedGroupFlatRow {
  type: 'completed-group'
  label: string
  topicId: string
  completedCount: number
}

export interface GanttTaskFlatRow {
  type: 'task-row'
  label: string
  topicId: string
  task: Task
}

export type GanttAllFlatRow = GanttTopicFlatRow | GanttTaskFlatRow
export type GanttFlatRow = GanttAllFlatRow | GanttCompletedGroupFlatRow

export interface GanttTaskOrder {
  topicId: string
  taskIds: string[]
}

export interface GanttTaskDates {
  startDate: Date | null
  dueDate: Date | null
}

export interface GanttRowProjection {
  /** 保存済み順序との同期判定に使う、完了タスクを含む全行 */
  allRows: GanttAllFlatRow[]
  /** 左右ペインへ描画する、完了グループの開閉を反映した行 */
  visibleRows: GanttFlatRow[]
  /** ガント表示範囲の計算に使う、開いているタスクだけを含むトピック行 */
  rangeRows: Array<{ topic: Topic; tasks: Task[] }>
}

export function projectGanttRows(
  sourceRows: readonly GanttSourceRow[],
  expandedCompletedTopicIds: Readonly<Record<string, boolean>>
): GanttRowProjection {
  const allRows: GanttAllFlatRow[] = []
  const visibleRows: GanttFlatRow[] = []
  const rangeRows: GanttRowProjection['rangeRows'] = []

  for (const { topic, tasks } of sourceRows) {
    const activeTasks: Task[] = []
    const completedTasks: Task[] = []
    const rangeTasks: Task[] = []
    const isCompletedExpanded = expandedCompletedTopicIds[topic.id] ?? false

    for (const task of tasks) {
      if (task.status === 'done') {
        completedTasks.push(task)
        if (isCompletedExpanded) rangeTasks.push(task)
      } else {
        activeTasks.push(task)
        rangeTasks.push(task)
      }
    }

    const topicRow: GanttTopicFlatRow = {
      type: 'topic',
      label: topic.name,
      topicId: topic.id,
    }
    allRows.push(topicRow)
    visibleRows.push(topicRow)

    for (const task of activeTasks) {
      const taskRow: GanttTaskFlatRow = {
        type: 'task-row',
        label: task.title,
        topicId: topic.id,
        task,
      }
      allRows.push(taskRow)
      visibleRows.push(taskRow)
    }

    if (completedTasks.length > 0) {
      visibleRows.push({
        type: 'completed-group',
        label: `完了タスク（${completedTasks.length}）`,
        topicId: topic.id,
        completedCount: completedTasks.length,
      })
    }

    for (const task of completedTasks) {
      const taskRow: GanttTaskFlatRow = {
        type: 'task-row',
        label: task.title,
        topicId: topic.id,
        task,
      }
      allRows.push(taskRow)
      if (isCompletedExpanded) visibleRows.push(taskRow)
    }

    // 表示範囲だけは元データの相対順序をそのまま保つ。
    rangeRows.push({ topic, tasks: rangeTasks })
  }

  return { allRows, visibleRows, rangeRows }
}

export function applyGanttTaskOrder(
  rows: GanttFlatRow[],
  taskOrder: GanttTaskOrder | null
): GanttFlatRow[] {
  if (!taskOrder) return rows

  const orderById = new Map(taskOrder.taskIds.map((id, index) => [id, index]))
  const orderedTopicRows = rows
    .filter(
      (row): row is GanttTaskFlatRow => row.type === 'task-row' && row.topicId === taskOrder.topicId
    )
    .sort((a, b) => {
      const aOrder = orderById.get(a.task.id) ?? Number.MAX_SAFE_INTEGER
      const bOrder = orderById.get(b.task.id) ?? Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
  let taskIndex = 0

  return rows.map((row) => {
    if (row.type !== 'task-row' || row.topicId !== taskOrder.topicId) return row
    return orderedTopicRows[taskIndex++] ?? row
  })
}

export function applyGanttPreview(
  rows: GanttFlatRow[],
  preview: ReadonlyMap<string, GanttTaskDates>
): GanttFlatRow[] {
  if (preview.size === 0) return rows

  return rows.map((row) => {
    if (row.type !== 'task-row') return row
    const dates = preview.get(row.task.id)
    return dates ? { ...row, task: { ...row.task, ...dates } } : row
  })
}
