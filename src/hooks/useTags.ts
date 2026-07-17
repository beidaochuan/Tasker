import { useTagsQuery } from './useDataQueries'
import type { Tag } from '@/types'

export function useTags(): Tag[] {
  return useTagsQuery().data ?? []
}
