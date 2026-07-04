import { useCallback } from 'react'
import { taskRepo } from '@/repositories'
import { getNextOccurrence, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useRefreshStore } from './useDataRefresh'
import type { Task } from '@/types'
import { unwrapResult } from '@/utils/resultUtils'

export interface UseRecurrenceResult {
  completeRecurringTask: (task: Task) => Promise<void>
}

export function useRecurrence(): UseRecurrenceResult {
  const refresh = useRefreshStore((s) => s.refresh)

  const completeRecurringTask = useCallback(
    async (task: Task) => {
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

      refresh()
    },
    [refresh]
  )

  return { completeRecurringTask }
}
