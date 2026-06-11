import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Project } from '@/types'
import { rowToProject } from '@/repositories/projectRepository'

export function useProjects(): Project[] {
  return (
    useLiveQuery(async () => {
      const rows = await db.projects.where('isArchived').equals(0).toArray()
      return rows.map(rowToProject)
    }) ?? []
  )
}

export function useProject(id: string | null): Project | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const row = await db.projects.get(id)
    if (!row) return undefined
    return rowToProject(row)
  }, [id])
}
