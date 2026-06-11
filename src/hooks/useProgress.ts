import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { calcProgress, calcProjectProgress } from '@/utils/progressUtils'

export function useTaskProgress(taskId: string): number {
  return (
    useLiveQuery(async () => {
      const subtasks = await db.subtasks.where('taskId').equals(taskId).toArray()
      return calcProgress(subtasks.map((s) => s.isDone === 1))
    }, [taskId]) ?? 0
  )
}

/**
 * 単一プロジェクトの進捗を返す。
 * 複数プロジェクト分を一括計算する場合は別途バルククエリが必要（N+1になるため）。
 */
export function useProjectProgress(projectId: string): number {
  return (
    useLiveQuery(async () => {
      const topics = await db.topics.where('projectId').equals(projectId).toArray()
      const topicIds = topics.map((t) => t.id)
      if (topicIds.length === 0) return 0
      const tasks = await db.tasks.where('topicId').anyOf(topicIds).toArray()
      return calcProjectProgress(tasks.map((t) => t.status))
    }, [projectId]) ?? 0
  )
}
