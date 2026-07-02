import { useCallback } from 'react'
import { taskRepo, taskCompletionRepo } from '@/repositories'
import { getNextOccurrence, hasRepeatRule } from '@/utils/recurrenceUtils'
import { useRefreshStore } from './useDataRefresh'
import type { Task } from '@/types'

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

      await taskRepo.update(task.id, { status: 'done' })
      await taskCompletionRepo.create(task.id)

      if (nextDue && isRecurring) {
        await taskRepo.create({
          topicId: task.topicId,
          title: task.title,
          description: task.description,
          status: 'todo',
          priority: task.priority,
          dueDate: nextDue,
          startDate: nextStart ?? null,
          order: 9999,
          tags: task.tags,
          repeatRule: task.repeatRule,
        })
      }

      refresh()
    },
    [refresh]
  )

  return { completeRecurringTask }
}
