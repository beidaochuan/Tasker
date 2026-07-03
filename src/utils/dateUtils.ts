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

export function formatDateInput(date: Date | null): string {
  if (date === null) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string): Date | null {
  const normalized = value.trim()
  if (!normalized) return null
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(normalized)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}
