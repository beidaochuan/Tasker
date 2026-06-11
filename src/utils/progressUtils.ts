import type { TaskStatus } from '@/types'

export function calcProgress(isDoneList: boolean[]): number {
  if (isDoneList.length === 0) return 0
  const done = isDoneList.filter(Boolean).length
  return Math.floor((done / isDoneList.length) * 100)
}

export function calcProjectProgress(statuses: TaskStatus[]): number {
  if (statuses.length === 0) return 0
  const done = statuses.filter((s) => s === 'done').length
  return Math.floor((done / statuses.length) * 100)
}
