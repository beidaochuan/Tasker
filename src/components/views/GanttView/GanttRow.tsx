import { memo } from 'react'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT } from './ganttConstants'
import { GanttBar } from './GanttBar'

interface Props {
  tasks: Task[]
  totalDays: number
  ganttStart: Date
  scale: GanttScale
  onBarPointerDown?: (e: React.PointerEvent, task: Task, handle: 'move' | 'left' | 'right') => void
  onBarClick?: (taskId: string) => void
}

export const GanttRow = memo(function GanttRow({
  tasks,
  totalDays,
  ganttStart,
  scale,
  onBarPointerDown,
  onBarClick,
}: Props) {
  const ppd = PIXELS_PER_DAY[scale]
  const totalWidth = totalDays * ppd

  return (
    // #5: 縦グリッド線を CSS repeating-linear-gradient で描画（DOM ノード生成ゼロ）
    <div
      className="relative border-b border-border"
      style={{
        width: totalWidth,
        height: ROW_HEIGHT,
        backgroundImage: `repeating-linear-gradient(
          to right,
          transparent,
          transparent ${ppd - 1}px,
          hsl(var(--border) / 0.3) ${ppd - 1}px,
          hsl(var(--border) / 0.3) ${ppd}px
        )`,
      }}
    >
      {tasks.map((task) => (
        <GanttBar
          key={task.id}
          task={task}
          ganttStart={ganttStart}
          scale={scale}
          onBarPointerDown={onBarPointerDown}
          onClick={onBarClick}
        />
      ))}
    </div>
  )
})
