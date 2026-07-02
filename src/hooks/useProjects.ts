import { useState, useEffect } from 'react'
import type { Project } from '@/types'
import { projectRepo } from '@/repositories'
import { useRefreshStore } from './useDataRefresh'

export function useProjects(): Project[] {
  const [projects, setProjects] = useState<Project[]>([])
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    projectRepo.getAll().then((r) => {
      if (r.ok) setProjects(r.data.filter((p) => !p.isArchived))
    })
  }, [counter])

  return projects
}

export function useProject(id: string | null): Project | undefined {
  const [project, setProject] = useState<Project | undefined>(undefined)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!id) {
      Promise.resolve().then(() => {
        if (!cancelled) setProject(undefined)
      })
      return () => {
        cancelled = true
      }
    }
    projectRepo.getById(id).then((r) => {
      if (!cancelled) setProject(r.ok ? r.data : undefined)
    })
    return () => {
      cancelled = true
    }
  }, [id, counter])

  return project
}
