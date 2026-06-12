import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays } from 'date-fns'
import { db } from '@/db/schema'
import { rowToTask } from '@/repositories/taskRepository'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import type { Task, TaskStatus } from '@/types'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  // FullCalendar の end は exclusive（終了日の翌日を指定する必要がある）
  end: Date
  allDay: boolean
  extendedProps: { task: Task }
  backgroundColor: string
  borderColor: string
}

// Issue #1: Record<TaskStatus, string> で型安全に — 新ステータス追加時にコンパイルエラーで検出
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#6366f1',
  in_progress: '#f59e0b',
  done: '#22c55e',
  cancelled: '#9ca3af',
}

export function useCalendarTasks(
  projectId: string | null,
  rangeStart: Date | null,
  rangeEnd: Date | null
): CalendarEvent[] {
  // Issue #3: useLiveQuery<Task[]> で戻り値型を明示
  const tasks = useLiveQuery<Task[]>(async () => {
    if (!projectId) return []
    const topicRows = await db.topics.where('projectId').equals(projectId).toArray()
    const topicIds = topicRows.map((t) => t.id)
    if (topicIds.length === 0) return []
    const taskRows = await db.tasks.where('topicId').anyOf(topicIds).toArray()
    return taskRows.map(rowToTask)
  }, [projectId])

  return useMemo(() => {
    if (!tasks) return []
    const events: CalendarEvent[] = []

    for (const task of tasks) {
      if (!task.dueDate) continue
      const color = STATUS_COLORS[task.status]

      if (hasRepeatRule(task.repeatRule)) {
        // rangeStart/rangeEnd が確定してから展開（datesSet 未発火の間はスキップ）
        if (!rangeStart || !rangeEnd) continue
        const occurrences = expandOccurrences(task.repeatRule, task.dueDate, rangeStart, rangeEnd)
        for (const date of occurrences) {
          events.push({
            id: `${task.id}_${date.getTime()}`,
            title: task.title,
            start: date,
            end: addDays(date, 1),
            allDay: true,
            extendedProps: { task },
            backgroundColor: color,
            borderColor: color,
          })
        }
      } else {
        // 繰り返しなし: そのまま表示
        const start = task.startDate ?? task.dueDate
        // Issue #2: addDays(date-fns) でイミュータブルに +1日
        const end = addDays(task.dueDate, 1)
        events.push({
          id: task.id,
          title: task.title,
          start,
          end,
          allDay: true,
          extendedProps: { task },
          backgroundColor: color,
          borderColor: color,
        })
      }
    }
    return events
  }, [tasks, rangeStart, rangeEnd])
}
