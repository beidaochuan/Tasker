import { memo, useCallback, useRef } from 'react'
import { differenceInDays, startOfDay } from 'date-fns'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT, RESIZE_HANDLE_WIDTH } from './ganttConstants'
import { resolveTaskId, isVirtualTask } from '@/utils/recurrenceUtils'

const STATUS_COLORS: Record<Exclude<Task['status'], 'cancelled'>, string> = {
  todo: 'bg-indigo-500',
  in_progress: 'bg-green-500',
  done: 'bg-gray-400',
}

interface Props {
  task: Task
  ganttStart: Date
  scale: GanttScale
  onBarPointerDown?: (
    e: React.PointerEvent,
    task: Task,
    handle: 'move' | 'left' | 'right',
    element: HTMLElement
  ) => void
  onClick?: (taskId: string) => void
}

export const GanttBar = memo(function GanttBar({
  task,
  ganttStart,
  scale,
  onBarPointerDown,
  onClick,
}: Props) {
  const didDragRef = useRef(false)

  const isVirtual = isVirtualTask(task.id)

  const ppd = PIXELS_PER_DAY[scale]
  const hasDate = !!(task.startDate || task.dueDate)
  const start = hasDate ? startOfDay(task.startDate ?? task.dueDate!) : null
  const end = hasDate ? startOfDay(task.dueDate ?? task.startDate!) : null
  const barStart = startOfDay(ganttStart)

  const left = start ? differenceInDays(start, barStart) * ppd : 0
  const durationDays = start && end ? Math.max(1, differenceInDays(end, start) + 1) : 1
  const width = durationDays * ppd

  // move 領域が確保できる最小幅（ハンドル×2 + 1px）
  const minMoveWidth = RESIZE_HANDLE_WIDTH * 2 + 1
  // バーが小さいときは左右を均等に二分割してリサイズ専用にする
  const handleWidth = width >= minMoveWidth ? RESIZE_HANDLE_WIDTH : Math.ceil(width / 2)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isVirtual || !onBarPointerDown) return
      e.stopPropagation()
      didDragRef.current = false

      // e.currentTarget はハンドラ終了後 null になるため先に保存
      const el = e.currentTarget

      // バー内のX座標で handle を判定
      const rect = el.getBoundingClientRect()
      const xInBar = e.clientX - rect.left
      let handle: 'move' | 'left' | 'right'
      if (xInBar <= handleWidth) {
        handle = 'left'
      } else if (xInBar >= width - handleWidth) {
        handle = 'right'
      } else {
        handle = 'move'
      }

      const startX = e.clientX
      const onMove = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - startX) > 4) didDragRef.current = true
      }
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', cleanup)
        window.removeEventListener('pointercancel', cleanup)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', cleanup)
      window.addEventListener('pointercancel', cleanup)

      onBarPointerDown(e, task, handle, el)
    },
    [isVirtual, onBarPointerDown, task, handleWidth, width]
  )

  if (!hasDate || task.status === 'cancelled') return null

  const barHeight = ROW_HEIGHT - 12
  const colorClass = STATUS_COLORS[task.status]

  return (
    <div
      className={`absolute top-[6px] rounded select-none flex items-center overflow-hidden ${colorClass}`}
      style={{ left, width, height: barHeight, cursor: isVirtual ? 'default' : 'grab' }}
      onPointerDown={handlePointerDown}
      onClick={() => {
        if (!didDragRef.current) onClick?.(resolveTaskId(task.id))
      }}
      title={task.title}
    />
  )
})
