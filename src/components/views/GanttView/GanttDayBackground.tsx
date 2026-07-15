import { memo, useMemo } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { getJapaneseHolidayName } from '@/utils/japaneseHolidays'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY } from './ganttConstants'

interface Props {
  startDate: Date
  totalDays: number
  scale: GanttScale
}

export const GanttDayBackground = memo(function GanttDayBackground({
  startDate,
  totalDays,
  scale,
}: Props) {
  const ppd = PIXELS_PER_DAY[scale]
  const totalWidth = totalDays * ppd
  const startTime = startDate.getTime()
  const start = startOfDay(new Date(startTime))
  const mondayBasedStartDay = (start.getDay() + 6) % 7

  const holidayColumns = useMemo(() => {
    const columns: Array<{ key: string; left: number }> = []
    const firstDay = startOfDay(new Date(startTime))
    for (let index = 0; index < totalDays; index++) {
      const date = addDays(firstDay, index)
      if (getJapaneseHolidayName(date)) {
        columns.push({ key: date.toISOString(), left: index * ppd })
      }
    }
    return columns
  }, [startTime, totalDays, ppd])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0"
      style={{
        width: totalWidth,
        backgroundImage: `linear-gradient(
          to right,
          transparent 0,
          transparent ${5 * ppd}px,
          hsl(var(--gantt-saturday-column)) ${5 * ppd}px,
          hsl(var(--gantt-saturday-column)) ${6 * ppd}px,
          hsl(var(--gantt-holiday-column)) ${6 * ppd}px,
          hsl(var(--gantt-holiday-column)) ${7 * ppd}px
        )`,
        backgroundPosition: `${-mondayBasedStartDay * ppd}px 0`,
        backgroundRepeat: 'repeat-x',
        backgroundSize: `${7 * ppd}px 100%`,
      }}
    >
      {holidayColumns.map((column) => (
        <span
          key={column.key}
          className="absolute inset-y-0 bg-[hsl(var(--gantt-holiday-column))]"
          style={{ left: column.left, width: ppd }}
        />
      ))}
    </div>
  )
})
