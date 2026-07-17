export interface TaskRow {
  id: string
  topicId: string
  title: string
  description: string
  status: string
  priority: string
  dueDate: number | null
  startDate: number | null
  order: number
  ganttOrder: number | null
  tags: string
  repeatRule: string | null
  statusChangedAt: number | null
  createdAt: number
  updatedAt: number
}

export type TaskApiRecord = Omit<TaskRow, 'tags' | 'statusChangedAt'> & {
  tags: string[]
  statusChangedAt: number
}

export function decodeTaskTags(value: unknown): string[] {
  let parsed = value

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (tag): tag is string => typeof tag === 'string' && tag.length > 0 && tag.length <= 128
  )
}

export function encodeTaskTags(tags: readonly string[]): string {
  return JSON.stringify(tags)
}

export function taskRowToApi(row: TaskRow): TaskApiRecord {
  return {
    ...row,
    statusChangedAt: row.statusChangedAt ?? row.updatedAt,
    tags: decodeTaskTags(row.tags),
  }
}
