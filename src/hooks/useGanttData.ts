import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfDay, addDays } from 'date-fns'
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
      tasks.sort((a, b) => {
        const aDate = a.startDate ?? a.dueDate
        const bDate = b.startDate ?? b.dueDate
        if (aDate && !bDate) return -1
        if (!aDate && bDate) return 1
        if (aDate && bDate && aDate.getTime() !== bDate.getTime()) {
          return aDate.getTime() - bDate.getTime()
        }
        return a.title.localeCompare(b.title, 'ja')
      })
    }
    return { topics, tasksByTopic }
  }, [projectId])

  return useMemo(() => {
    if (!raw) return []

    const today = startOfDay(new Date())

    return raw.topics.map((topic) => {
      const baseTasks = raw.tasksByTopic[topic.id] ?? []
      const tasks: Task[] = []

      for (const task of baseTasks) {
        if (task.status === 'cancelled') continue
        if (hasRepeatRule(task.repeatRule) && task.dueDate) {
          // 今日以降の直近1件だけ表示（今日を含む次の発生日を expandOccurrences で取得）
          const farFuture = addDays(today, 3650)
          const upcoming = expandOccurrences(task.repeatRule, task.dueDate, today, farFuture)
          const nextDate = upcoming[0] ?? task.dueDate
          const duration = task.startDate ? task.dueDate.getTime() - task.startDate.getTime() : null
          tasks.push({
            ...task,
            id: `${task.id}_${nextDate.getTime()}`,
            dueDate: nextDate,
            startDate: duration !== null ? new Date(nextDate.getTime() - duration) : null,
          })
        } else {
          tasks.push(task)
        }
      }

      return { topic, tasks }
    })
  }, [raw])
}
