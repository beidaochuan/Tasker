import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { db } from '@/db/schema'
import { getNextOccurrence, hasRepeatRule } from '@/utils/recurrenceUtils'
import { toUnixMs } from '@/utils/dateUtils'
import type { Task } from '@/types'

export interface UseRecurrenceResult {
  completeRecurringTask: (task: Task) => Promise<void>
}

export function useRecurrence(): UseRecurrenceResult {
  const completeRecurringTask = useCallback(async (task: Task) => {
    const base = task.dueDate ?? new Date()
    const nextDue = hasRepeatRule(task.repeatRule) ? getNextOccurrence(task.repeatRule, base) : null
    const duration =
      nextDue && task.startDate && task.dueDate
        ? task.dueDate.getTime() - task.startDate.getTime()
        : null
    const nextStart = nextDue && duration !== null ? new Date(nextDue.getTime() - duration) : null

    await db.transaction('rw', db.tasks, db.task_completions, async () => {
      const updated = await db.tasks.update(task.id, { status: 'done', updatedAt: Date.now() })
      if (updated === 0) throw new Error(`Task ${task.id} not found`)

      await db.task_completions.add({
        id: nanoid(10),
        taskId: task.id,
        completedAt: Date.now(),
      })

      if (!nextDue || !hasRepeatRule(task.repeatRule)) return

      const order = await db.tasks.where('topicId').equals(task.topicId).count()
      const now = Date.now()
      await db.tasks.add({
        id: nanoid(10),
        topicId: task.topicId,
        title: task.title,
        description: task.description,
        status: 'todo',
        priority: task.priority,
        dueDate: toUnixMs(nextDue),
        startDate: nextStart ? toUnixMs(nextStart) : null,
        order,
        tags: task.tags,
        repeatRule: task.repeatRule,
        createdAt: now,
        updatedAt: now,
      })
    })
  }, [])

  return { completeRecurringTask }
}
