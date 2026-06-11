import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Tag } from '@/types'

export function useTags(): Tag[] {
  return useLiveQuery(() => db.tags.toArray()) ?? []
}
