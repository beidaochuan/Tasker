import { useState, useEffect, useMemo } from 'react'
import { startOfDay, addDays } from 'date-fns'
import { topicRepo, taskRepo } from '@/repositories'
import { sortByOrder } from '@/utils/sortUtils'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useRefreshStore } from './useDataRefresh'
import type { Task, Topic } from '@/types'

const GANTT_LOOKAHEAD_DAYS = 3650 // 繰り返しタスクの展開上限: 約10年

export interface GanttRow {
  topic: Topic
  tasks: Task[]
}

interface RawGanttData {
  topics: Topic[]
  tasksByTopic: Record<string, Task[]>
}

export function useGanttData(projectId: string | null): GanttRow[] {
  const [raw, setRaw] = useState<RawGanttData | null>(null)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      Promise.resolve().then(() => {
        if (!cancelled) setRaw(null)
      })
      return () => {
        cancelled = true
      }
    }
    Promise.all([topicRepo.getByProjectId(projectId), taskRepo.getByProjectId(projectId)]).then(
      ([tr, taskR]) => {
        if (cancelled || !tr.ok || !taskR.ok) return
        const topics: Topic[] = sortByOrder(tr.data)
        const tasksByTopic: Record<string, Task[]> = {}
        for (const task of taskR.data) {
          ;(tasksByTopic[task.topicId] ??= []).push(task)
        }
        setRaw({ topics, tasksByTopic })
      }
    )
    return () => {
      cancelled = true
    }
  }, [projectId, counter])

  return useMemo(() => {
    if (!raw) return []
    const today = startOfDay(new Date())

    return raw.topics.map((topic) => {
      const baseTasks = raw.tasksByTopic[topic.id] ?? []
      const tasks: Task[] = []

      for (const task of baseTasks) {
        if (task.status === 'cancelled') continue
        if (hasRepeatRule(task.repeatRule) && task.dueDate) {
          const farFuture = addDays(today, GANTT_LOOKAHEAD_DAYS)
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

      return { topic, tasks }
    })
  }, [raw])
}
