import type { Task, TaskStatus, Priority } from '@/types'

export interface FilterCriteria {
  searchText: string
  statuses: TaskStatus[]
  priorities: Priority[]
  tagIds: string[]
  dueDateFrom: Date | null
  dueDateTo: Date | null
}

export function applyFilter(tasks: Task[], filter: FilterCriteria): Task[] {
  const { searchText, statuses, priorities, tagIds, dueDateFrom, dueDateTo } = filter
  const query = searchText.toLowerCase()

  return tasks.filter((task) => {
    if (query) {
      const hit =
        task.title.toLowerCase().includes(query) ||
        (task.description.length > 0 && task.description.toLowerCase().includes(query))
      if (!hit) return false
    }

    if (statuses.length > 0 && !statuses.includes(task.status)) return false
    if (priorities.length > 0 && !priorities.includes(task.priority)) return false

    if (tagIds.length > 0) {
      const hasTag = tagIds.some((id) => task.tags.includes(id))
      if (!hasTag) return false
    }

    if (dueDateFrom !== null || dueDateTo !== null) {
      if (task.dueDate === null) return false
      const ms = task.dueDate.getTime()
      if (dueDateFrom !== null && ms < dueDateFrom.getTime()) return false
      // dueDateTo は当日の 00:00 を指定する想定（境界含む）。
      // 「当日の終わりまで含める」場合は to の翌日 00:00 未満に変換すること。
      if (dueDateTo !== null && ms > dueDateTo.getTime()) return false
    }

    return true
  })
}
