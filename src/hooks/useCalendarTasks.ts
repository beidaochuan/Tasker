import { useMemo } from 'react'
import { addDays } from 'date-fns'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useProjectTasks } from './useTasks'
import type { Task, TaskStatus } from '@/types'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  extendedProps: { task: Task }
  backgroundColor: string
  borderColor: string
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#6366f1',
  in_progress: '#f59e0b',
  done: '#22c55e',
}

export function useCalendarTasks(
  projectId: string | null,
  rangeStart: Date | null,
  rangeEnd: Date | null
): CalendarEvent[] {
  const tasks = useProjectTasks(projectId)

  return useMemo(() => {
    const events: CalendarEvent[] = []
    for (const task of tasks ?? []) {
      if (!task.dueDate) continue
      const color = STATUS_COLORS[task.status]

      if (hasRepeatRule(task.repeatRule)) {
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
        const start = task.startDate ?? task.dueDate
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
