import { useMemo } from 'react'
import { useTasksByTopic } from './useTasks'
import { useFilterStore } from '@/store/filterStore'
import { applyFilter } from '@/utils/filterUtils'
import type { Task } from '@/types'

export function useFilteredTasksByTopic(topicId: string): Task[] {
  const tasks = useTasksByTopic(topicId)
  const { searchText, statuses, priorities, tagIds, dueDateFrom, dueDateTo } = useFilterStore()

  // Date オブジェクトは参照比較で差異なしと誤判定されることがあるため、
  // ms 値に変換した変数を依存配列に使って確実に再計算をトリガーする
  const dueDateFromMs = dueDateFrom?.getTime() ?? null
  const dueDateToMs = dueDateTo?.getTime() ?? null

  return useMemo(
    () => applyFilter(tasks, { searchText, statuses, priorities, tagIds, dueDateFrom, dueDateTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, searchText, statuses, priorities, tagIds, dueDateFromMs, dueDateToMs]
  )
}
