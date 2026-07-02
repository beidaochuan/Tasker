import { useState, useEffect } from 'react'
import { subtaskRepo, taskRepo } from '@/repositories'
import { calcProgress, calcProjectProgress } from '@/utils/progressUtils'
import { useRefreshStore } from './useDataRefresh'

export function useTaskProgress(taskId: string): number {
  const [progress, setProgress] = useState(0)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    subtaskRepo.getByTaskId(taskId).then((r) => {
      if (r.ok) setProgress(calcProgress(r.data.map((s) => s.isDone)))
    })
  }, [taskId, counter])

  return progress
}

export function useProjectProgress(projectId: string): number {
  const [progress, setProgress] = useState(0)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    taskRepo.getByProjectId(projectId).then((r) => {
      if (!r.ok) return
      setProgress(calcProjectProgress(r.data.map((t) => t.status)))
    })
  }, [projectId, counter])

  return progress
}
