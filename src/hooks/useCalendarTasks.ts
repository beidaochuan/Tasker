import { useState, useEffect, useMemo } from 'react'
import { addDays } from 'date-fns'
import { taskRepo } from '@/repositories'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useRefreshStore } from './useDataRefresh'
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
  cancelled: '#9ca3af',
}

export function useCalendarTasks(
  projectId: string | null,
  rangeStart: Date | null,
  rangeEnd: Date | null
): CalendarEvent[] {
  const [tasks, setTasks] = useState<Task[]>([])
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      Promise.resolve().then(() => {
        if (!cancelled) setTasks([])
      })
      return () => {
        cancelled = true
      }
    }
    taskRepo.getByProjectId(projectId).then((r) => {
      if (!cancelled) setTasks(r.ok ? r.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [projectId, counter])

  return useMemo(() => {
    const events: CalendarEvent[] = []
    for (const task of tasks) {
      if (task.status === 'cancelled') continue
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
