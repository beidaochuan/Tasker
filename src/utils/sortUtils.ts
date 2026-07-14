import type { Priority, TaskStatus } from '@/types'

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

export function sortKanbanColumnTasks<
  T extends { priority: Priority; statusChangedAt?: Date; updatedAt: Date },
>(status: TaskStatus, items: T[]): T[] {
  if (status === 'todo' || status === 'in_progress') return sortByPriority(items)

  return [...items].sort((a, b) => {
    const aChangedAt = (a.statusChangedAt ?? a.updatedAt).getTime()
    const bChangedAt = (b.statusChangedAt ?? b.updatedAt).getTime()
    return bChangedAt - aChangedAt
  })
}

export function sortGanttTasks<
  T extends { dueDate: Date | null; ganttOrder?: number | null; title: string },
>(items: T[]): T[] {
  const hasManualOrder = items.some((item) => item.ganttOrder != null)
  return [...items].sort((a, b) => {
    if (hasManualOrder) {
      const aOrder = a.ganttOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.ganttOrder ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
    }
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    if (a.dueDate && b.dueDate && a.dueDate.getTime() !== b.dueDate.getTime()) {
      return a.dueDate.getTime() - b.dueDate.getTime()
    }
    return a.title.localeCompare(b.title, 'ja')
  })
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
