import { useMemo } from 'react'
import type { Project } from '@/types'
import { useProjectsQuery } from './useDataQueries'

export function useProjects(): Project[] {
  const query = useProjectsQuery()
  return useMemo(() => (query.data ?? []).filter((project) => !project.isArchived), [query.data])
}

export function useProject(id: string | null): Project | undefined {
  const query = useProjectsQuery()
  return useMemo(() => query.data?.find((project) => project.id === id), [id, query.data])
}
