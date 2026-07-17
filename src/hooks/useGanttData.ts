import { useMemo } from 'react'
import { startOfDay, addDays } from 'date-fns'
import { sortGanttTasks } from '@/utils/sortUtils'
import { expandOccurrences, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useProjectData } from './useTasks'
import type { Task, Topic } from '@/types'

const GANTT_LOOKAHEAD_DAYS = 3650 // 繰り返しタスクの展開上限: 約10年

export interface GanttRow {
  topic: Topic
  tasks: Task[]
}

export function useGanttData(projectId: string | null): GanttRow[] {
  const { topics, tasks } = useProjectData(projectId)

  return useMemo(() => {
    if (!topics || !tasks) return []
    const today = startOfDay(new Date())
    const tasksByTopic: Record<string, Task[]> = {}
    for (const task of tasks) {
      ;(tasksByTopic[task.topicId] ??= []).push(task)
    }

    return topics.map((topic) => {
      const expandedTasks: Task[] = []

      for (const task of tasksByTopic[topic.id] ?? []) {
        if (hasRepeatRule(task.repeatRule) && task.dueDate) {
          const farFuture = addDays(today, GANTT_LOOKAHEAD_DAYS)
          const upcoming = expandOccurrences(task.repeatRule, task.dueDate, today, farFuture)
          const nextDate = upcoming[0] ?? task.dueDate
          const duration = task.startDate ? task.dueDate.getTime() - task.startDate.getTime() : null
          expandedTasks.push({
            ...task,
            id: `${task.id}_${nextDate.getTime()}`,
            dueDate: nextDate,
            startDate: duration !== null ? new Date(nextDate.getTime() - duration) : null,
          })
        } else {
          expandedTasks.push(task)
        }
      }

      return { topic, tasks: sortGanttTasks(expandedTasks) }
    })
  }, [tasks, topics])
}
