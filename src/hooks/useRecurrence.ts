import { useCallback } from 'react'
import { taskRepo } from '@/repositories'
import { getNextOccurrence, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useDataQueryStore } from './useDataQueries'
import type { Task } from '@/types'
import { unwrapResult } from '@/utils/resultUtils'

export interface UseRecurrenceResult {
  completeRecurringTask: (task: Task, projectIds: readonly string[]) => Promise<void>
}

export function useRecurrence(): UseRecurrenceResult {
  const invalidateProjectTasks = useDataQueryStore((state) => state.invalidateProjectTasks)

  const completeRecurringTask = useCallback(
    async (task: Task, projectIds: readonly string[]) => {
      const base = task.dueDate ?? new Date()
      const isRecurring = hasRepeatRule(task.repeatRule)
      const nextDue = isRecurring ? getNextOccurrence(task.repeatRule, base) : null
      const duration =
        nextDue && task.startDate && task.dueDate
          ? task.dueDate.getTime() - task.startDate.getTime()
          : null
      const nextStart = nextDue && duration !== null ? new Date(nextDue.getTime() - duration) : null
      const nextTask =
        nextDue && isRecurring
          ? {
              topicId: task.topicId,
              title: task.title,
              description: task.description,
              status: 'todo' as const,
              priority: task.priority,
              dueDate: nextDue,
              startDate: nextStart ?? null,
              order: 9999,
              tags: task.tags,
              repeatRule: task.repeatRule,
            }
          : null

      unwrapResult(await taskRepo.completeRecurring(task.id, nextTask))

      for (const projectId of new Set(projectIds)) invalidateProjectTasks(projectId)
    },
    [invalidateProjectTasks]
  )

  return { completeRecurringTask }
}
