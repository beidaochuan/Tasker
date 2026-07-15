import { memo, useMemo } from 'react'
import { addDays, startOfDay, format, startOfMonth, getDaysInMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/utils/cn'
import { getJapaneseHolidayName } from '@/utils/japaneseHolidays'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, HEADER_HEIGHT } from './ganttConstants'
import { GanttDayBackground } from './GanttDayBackground'

interface Props {
  startDate: Date
  totalDays: number
  scale: GanttScale
}

interface HeaderCell {
  label: string
  weekday?: string
  dayKind?: 'saturday' | 'holiday'
  title?: string
  left: number
  width: number
}

function buildDayCells(startDate: Date, totalDays: number, ppd: number): HeaderCell[] {
  return Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(startDate, i)
    const holidayName = getJapaneseHolidayName(d)
    const dayKind =
      holidayName || d.getDay() === 0 ? 'holiday' : d.getDay() === 6 ? 'saturday' : undefined
    const dayDescription =
      holidayName ?? (d.getDay() === 0 ? '日曜日' : d.getDay() === 6 ? '土曜日' : null)
    return {
      label: format(d, 'd', { locale: ja }),
      weekday: format(d, 'EEE', { locale: ja }),
      dayKind,
      title: dayDescription
        ? `${format(d, 'yyyy年M月d日', { locale: ja })} ${dayDescription}`
        : undefined,
      left: i * ppd,
      width: ppd,
    }
  })
}

function buildWeekCells(startDate: Date, totalDays: number, ppd: number): HeaderCell[] {
  // 上段: 月ごとにまとめ、下段: 各日
  const cells: HeaderCell[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(startDate, i)
    const dayOfWeek = d.getDay()
    // 月曜始まりで週ラベル（月曜に出す）
    if (dayOfWeek === 1 || i === 0) {
      cells.push({
        label: format(d, 'M/d', { locale: ja }),
        left: i * ppd,
        width: 7 * ppd,
      })
    }
  }
  return cells
}

function buildMonthCells(startDate: Date, totalDays: number, ppd: number): HeaderCell[] {
  const cells: HeaderCell[] = []
  let i = 0
  while (i < totalDays) {
    const d = addDays(startDate, i)
    const monthStart = startOfMonth(d)
    const daysInMonth = getDaysInMonth(monthStart)
    const offsetInMonth = Math.max(0, Math.floor((d.getTime() - monthStart.getTime()) / 86400000))
    const remaining = daysInMonth - offsetInMonth
    const span = Math.min(remaining, totalDays - i)
    cells.push({
      label: format(d, 'yyyy年M月', { locale: ja }),
      left: i * ppd,
      width: span * ppd,
    })
    i += span
  }
  return cells
}

export const GanttHeader = memo(function GanttHeader({ startDate, totalDays, scale }: Props) {
  const ppd = PIXELS_PER_DAY[scale]
  const totalWidth = totalDays * ppd
  const startTime = startDate.getTime()

  const upperCells = useMemo<HeaderCell[]>(() => {
    const start = new Date(startTime)
    // #8: day と week はどちらも上段に月を表示する
    if (scale === 'day' || scale === 'week') {
      return buildMonthCells(startOfDay(start), totalDays, ppd)
    }
    // month: 上段: 年
    const cells: HeaderCell[] = []
    let i = 0
    while (i < totalDays) {
      const d = addDays(start, i)
      const year = d.getFullYear()
      const yearStart = new Date(year, 0, 1)
      const nextYear = new Date(year + 1, 0, 1)
      const yearDays = Math.floor((nextYear.getTime() - yearStart.getTime()) / 86400000)
      const offsetInYear = Math.floor((d.getTime() - yearStart.getTime()) / 86400000)
      const span = Math.min(yearDays - offsetInYear, totalDays - i)
      cells.push({
        label: `${year}年`,
        left: i * ppd,
        width: span * ppd,
      })
      i += span
    }
    return cells
  }, [startTime, totalDays, scale, ppd])

  const lowerCells = useMemo<HeaderCell[]>(() => {
    const start = new Date(startTime)
    if (scale === 'day') return buildDayCells(startOfDay(start), totalDays, ppd)
    if (scale === 'week') return buildWeekCells(startOfDay(start), totalDays, ppd)
    return buildMonthCells(startOfDay(start), totalDays, ppd)
  }, [startTime, totalDays, scale, ppd])

  const halfH = HEADER_HEIGHT / 2

  return (
    <div
      className="relative select-none border-b border-border bg-muted/50"
      style={{ width: totalWidth, height: HEADER_HEIGHT }}
    >
      <GanttDayBackground startDate={startDate} totalDays={totalDays} scale={scale} />
      {/* 上段 */}
      {upperCells.map((cell, i) => (
        <div
          key={i}
          className="absolute flex items-center border-r border-border px-1 text-xs font-medium text-muted-foreground overflow-hidden"
          style={{ left: cell.left, top: 0, width: cell.width, height: halfH }}
        >
          <span className="truncate">{cell.label}</span>
        </div>
      ))}
      {/* 下段 */}
      {lowerCells.map((cell, i) => (
        <div
          key={i}
          title={cell.title}
          data-day-kind={cell.dayKind}
          className={cn(
            'absolute flex items-center overflow-hidden border-r border-border px-1 text-xs text-foreground',
            cell.dayKind === 'saturday' && 'text-blue-600 dark:text-blue-400',
            cell.dayKind === 'holiday' && 'text-red-600 dark:text-red-400'
          )}
          style={{ left: cell.left, top: halfH, width: cell.width, height: halfH }}
        >
          {cell.weekday ? (
            <span className="flex min-w-0 flex-col items-center leading-none">
              <span>{cell.label}</span>
              <span className={cn('mt-0.5 text-[10px]', !cell.dayKind && 'text-muted-foreground')}>
                {cell.weekday}
              </span>
            </span>
          ) : (
            <span className="truncate">{cell.label}</span>
          )}
        </div>
      ))}
    </div>
  )
})
