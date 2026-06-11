import { differenceInDays, startOfDay } from 'date-fns'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY } from './ganttConstants'

interface Props {
  ganttStart: Date
  totalDays: number
  scale: GanttScale
}

export function GanttTodayLine({ ganttStart, totalDays, scale }: Props) {
  const ppd = PIXELS_PER_DAY[scale]
  const today = startOfDay(new Date())
  const offset = differenceInDays(today, startOfDay(ganttStart))

  if (offset < 0 || offset >= totalDays) return null

  const left = offset * ppd + ppd / 2

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-70 pointer-events-none z-20"
      style={{ left }}
    />
  )
}
