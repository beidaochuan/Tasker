import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, startOfDay } from 'date-fns'
import { db } from '@/db/schema'
import { rowToTask } from '@/repositories/taskRepository'
import { fromUnixMs } from '@/utils/dateUtils'
import { sortByOrder } from '@/utils/sortUtils'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import type { Task, Topic } from '@/types'

export interface GanttRow {
  topic: Topic
  tasks: Task[]
}

interface RawGanttData {
  topics: Topic[]
  tasksByTopic: Record<string, Task[]>
}

// 繰り返し展開の対象ウィンドウ: 今日の前後 6 ヶ月
const EXPAND_MONTHS_BEFORE = 6
const EXPAND_MONTHS_AFTER = 6

export function useGanttData(projectId: string | null): GanttRow[] {
  // #9: 型パラメータを明示して RawGanttData | null の型推論を確定させる
  const raw = useLiveQuery<RawGanttData | null>(async () => {
    if (!projectId) return null
    const topicRows = await db.topics.where('projectId').equals(projectId).toArray()
    const topics: Topic[] = sortByOrder(
      topicRows.map((r) => ({ ...r, createdAt: fromUnixMs(r.createdAt) }))
    )
    const topicIds = topics.map((t) => t.id)
    if (topicIds.length === 0) return { topics, tasksByTopic: {} }
    const taskRows = await db.tasks.where('topicId').anyOf(topicIds).toArray()
    const tasksByTopic: Record<string, Task[]> = {}
    for (const row of taskRows) {
      const task = rowToTask(row)
      ;(tasksByTopic[task.topicId] ??= []).push(task)
    }
    for (const tasks of Object.values(tasksByTopic)) {
      tasks.sort((a, b) => a.order - b.order)
    }
    return { topics, tasksByTopic }
  }, [projectId])

  return useMemo(() => {
    if (!raw) return []

    const today = startOfDay(new Date())
    const rangeStart = addMonths(today, -EXPAND_MONTHS_BEFORE)
    const rangeEnd = addMonths(today, EXPAND_MONTHS_AFTER)

    return raw.topics.map((topic) => {
      const baseTasks = raw.tasksByTopic[topic.id] ?? []
      const tasks: Task[] = []

      for (const task of baseTasks) {
        if (hasRepeatRule(task.repeatRule) && task.dueDate) {
          const occurrences = expandOccurrences(task.repeatRule, task.dueDate, rangeStart, rangeEnd)
          for (const date of occurrences) {
            tasks.push({
              ...task,
              id: `${task.id}_${date.getTime()}`,
              dueDate: date,
              startDate: task.startDate
                ? new Date(date.getTime() - (task.dueDate.getTime() - task.startDate.getTime()))
                : null,
            })
          }
        } else {
          tasks.push(task)
        }
      }

      return { topic, tasks }
    })
  }, [raw])
}
