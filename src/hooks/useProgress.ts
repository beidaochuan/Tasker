import { useState, useEffect } from 'react'
import { subtaskRepo } from '@/repositories'
import { calcProgress, calcProjectProgress } from '@/utils/progressUtils'
import { useProjectTasks } from './useTasks'

export function useTaskProgress(taskId: string): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    subtaskRepo.getByTaskId(taskId).then((r) => {
      if (r.ok) setProgress(calcProgress(r.data.map((s) => s.isDone)))
    })
  }, [taskId])

  return progress
}

export function useProjectProgress(projectId: string): number {
  const tasks = useProjectTasks(projectId)
  return calcProjectProgress((tasks ?? []).map((task) => task.status))
}
