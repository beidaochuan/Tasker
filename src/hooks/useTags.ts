import { useState, useEffect } from 'react'
import type { Tag } from '@/types'
import { tagRepo } from '@/repositories'
import { useRefreshStore } from './useDataRefresh'

export function useTags(): Tag[] {
  const [tags, setTags] = useState<Tag[]>([])
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    tagRepo.getAll().then((r) => {
      setTags(r.ok ? r.data : [])
    })
  }, [counter])

  return tags
}
