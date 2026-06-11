import { format, isToday, isAfter, isBefore, addDays } from 'date-fns'

export function toUnixMs(date: Date): number {
  return date.getTime()
}

export function fromUnixMs(ms: number): Date {
  return new Date(ms)
}

export function isOverdue(dueDate: Date | null): boolean {
  if (dueDate === null) return false
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return isBefore(dueDate, now)
}

export function isDueToday(dueDate: Date | null): boolean {
  if (dueDate === null) return false
  return isToday(dueDate)
}

export function isDueSoon(dueDate: Date | null, days: number): boolean {
  if (dueDate === null) return false
  const now = new Date()
  const threshold = addDays(now, days)
  return isAfter(dueDate, now) && isBefore(dueDate, threshold)
}

export function formatDate(date: Date | null): string {
  if (date === null) return ''
  return format(date, 'yyyy/MM/dd')
}
