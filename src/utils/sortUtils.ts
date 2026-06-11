import type { Priority } from '@/types'

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}

export function sortByDueDate<T extends { dueDate: Date | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.dueDate === null && b.dueDate === null) return 0
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate.getTime() - b.dueDate.getTime()
  })
}

export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
}

export function reorderItems<T extends { id: string; order: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const sorted = sortByOrder(items)
  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)
  return sorted.map((item, idx) => ({ ...item, order: idx }))
}
