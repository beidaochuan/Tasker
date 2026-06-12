import { memo, useCallback } from 'react'
import { differenceInDays, startOfDay } from 'date-fns'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT, RESIZE_HANDLE_WIDTH } from './ganttConstants'
import { resolveTaskId } from '@/utils/recurrenceUtils'

const STATUS_COLORS: Record<Task['status'], string> = {
  todo: 'bg-indigo-500',
  in_progress: 'bg-amber-500',
  done: 'bg-green-500',
  cancelled: 'bg-gray-400',
}

interface Props {
  task: Task
  ganttStart: Date
  scale: GanttScale
  onBarPointerDown?: (e: React.PointerEvent, task: Task, handle: 'move' | 'left' | 'right') => void
  onClick?: (taskId: string) => void
}

export const GanttBar = memo(function GanttBar({
  task,
  ganttStart,
  scale,
  onBarPointerDown,
  onClick,
}: Props) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: 'move' | 'left' | 'right') => {
      e.stopPropagation()
      onBarPointerDown?.(e, task, handle)
    },
    [onBarPointerDown, task]
  )

  if (!task.startDate && !task.dueDate) return null

  // 繰り返し展開の仮想インスタンス（ID が "taskId_timestamp" 形式）はドラッグ不可
  const isVirtual = /^\S+_\d+$/.test(task.id)

  const ppd = PIXELS_PER_DAY[scale]
  const start = startOfDay(task.startDate ?? task.dueDate!)
  const end = startOfDay(task.dueDate ?? task.startDate!)
  const barStart = startOfDay(ganttStart)

  const left = differenceInDays(start, barStart) * ppd
  const durationDays = Math.max(1, differenceInDays(end, start) + 1)
  const width = durationDays * ppd

  const colorClass = STATUS_COLORS[task.status]
  const barHeight = ROW_HEIGHT - 12

  return (
    <div
      className={`absolute top-[6px] rounded cursor-pointer select-none flex items-center overflow-hidden ${colorClass}`}
      style={{ left, width, height: barHeight }}
      onPointerDown={isVirtual ? undefined : (e) => handlePointerDown(e, 'move')}
      onClick={() => onClick?.(resolveTaskId(task.id))}
      title={task.title}
    >
      {!isVirtual && (
        <div
          className="absolute left-0 top-0 h-full cursor-ew-resize z-10 hover:bg-black/20"
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onPointerDown={(e) => handlePointerDown(e, 'left')}
        />
      )}
      <span className="mx-2 truncate text-xs text-white font-medium pointer-events-none">
        {task.title}
      </span>
      {!isVirtual && (
        <div
          className="absolute right-0 top-0 h-full cursor-ew-resize z-10 hover:bg-black/20"
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onPointerDown={(e) => handlePointerDown(e, 'right')}
        />
      )}
    </div>
  )
})
