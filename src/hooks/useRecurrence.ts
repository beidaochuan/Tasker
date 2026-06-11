import { useCallback } from 'react'
import { taskRepo, taskCompletionRepo } from '@/repositories'
import { getNextOccurrence, hasRepeatRule } from '@/utils/recurrenceUtils'
import type { Task } from '@/types'

export interface UseRecurrenceResult {
  completeRecurringTask: (task: Task) => Promise<void>
}

export function useRecurrence(): UseRecurrenceResult {
  const completeRecurringTask = useCallback(async (task: Task) => {
    if (!hasRepeatRule(task.repeatRule)) {
      // 繰り返しなし: 完了に更新 → 記録
      await taskRepo.update(task.id, { status: 'done' })
      await taskCompletionRepo.create(task.id)
      return
    }

    const base = task.dueDate ?? new Date()
    const nextDue = getNextOccurrence(task.repeatRule, base)

    if (!nextDue) {
      // 次回日付が計算できない場合も同様
      await taskRepo.update(task.id, { status: 'done' })
      await taskCompletionRepo.create(task.id)
      return
    }

    // 元タスク完了 → 完了記録 → 次回インスタンス作成の順で副作用を最小化
    // （completion より先に update が失敗しても孤立記録が残らない）
    await taskRepo.update(task.id, { status: 'done' })
    await taskCompletionRepo.create(task.id)

    const existing = await taskRepo.getByTopicId(task.topicId)
    const order = existing.ok ? existing.data.length : 0

    await taskRepo.create({
      topicId: task.topicId,
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: task.priority,
      dueDate: nextDue,
      startDate: task.startDate,
      order,
      tags: task.tags,
      repeatRule: task.repeatRule,
    })
  }, [])

  return { completeRecurringTask }
}
