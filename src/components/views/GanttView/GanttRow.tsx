import { memo, useRef, useCallback } from 'react'
import { addDays, startOfDay } from 'date-fns'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT } from './ganttConstants'
import { GanttBar } from './GanttBar'

interface Props {
  tasks: Task[]
  totalDays: number
  ganttStart: Date
  scale: GanttScale
  onBarPointerDown?: (
    e: React.PointerEvent,
    task: Task,
    handle: 'move' | 'left' | 'right',
    element: HTMLElement
  ) => void
  onBarClick?: (taskId: string) => void
  onCreateBar?: (taskId: string, startDate: Date, dueDate: Date) => void | Promise<void>
}

export const GanttRow = memo(function GanttRow({
  tasks,
  totalDays,
  ganttStart,
  scale,
  onBarPointerDown,
  onBarClick,
  onCreateBar,
}: Props) {
  const ppd = PIXELS_PER_DAY[scale]
  const totalWidth = totalDays * ppd
  const task = tasks[0]
  const hasBar = task && (task.startDate || task.dueDate)

  // ドラッグ作成用プレビュー状態
  const dragRef = useRef<{ startDay: number } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const xToDay = useCallback(
    (clientX: number, rowEl: HTMLElement) => {
      const rect = rowEl.getBoundingClientRect()
      const scrollLeft = rowEl.closest('.overflow-auto')?.scrollLeft ?? 0
      const x = clientX - rect.left + scrollLeft
      return Math.floor(x / ppd)
    },
    [ppd]
  )

  const showPreview = useCallback(
    (startDay: number, endDay: number) => {
      const el = previewRef.current
      if (!el) return
      const left = Math.min(startDay, endDay) * ppd
      const width = (Math.abs(endDay - startDay) + 1) * ppd
      el.style.left = `${left}px`
      el.style.width = `${width}px`
      el.style.display = 'block'
    },
    [ppd]
  )

  const hidePreview = useCallback(() => {
    if (previewRef.current) previewRef.current.style.display = 'none'
  }, [])

  const handleRowPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (hasBar || !task || !onCreateBar) return
      e.preventDefault()
      const row = e.currentTarget
      row.setPointerCapture(e.pointerId)
      const startDay = xToDay(e.clientX, row)
      dragRef.current = { startDay }
      showPreview(startDay, startDay)

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const endDay = xToDay(ev.clientX, row)
        showPreview(dragRef.current.startDay, endDay)
      }
      const onUp = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const endDay = xToDay(ev.clientX, row)
        hidePreview()
        const s = Math.min(dragRef.current.startDay, endDay)
        const d = Math.max(dragRef.current.startDay, endDay)
        dragRef.current = null
        row.removeEventListener('pointermove', onMove)
        row.removeEventListener('pointerup', onUp)
        const ganttStartDay = startOfDay(ganttStart)
        const startDate = addDays(ganttStartDay, s)
        const dueDate = addDays(ganttStartDay, d)
        Promise.resolve(onCreateBar(task.id, startDate, dueDate)).catch((err) => {
          console.error('ガントバーの作成に失敗しました', err)
        })
      }
      row.addEventListener('pointermove', onMove)
      row.addEventListener('pointerup', onUp)
    },
    [hasBar, task, onCreateBar, xToDay, showPreview, hidePreview, ganttStart]
  )

  return (
    <div
      className="relative border-b border-border"
      style={{
        width: totalWidth,
        height: ROW_HEIGHT,
        cursor: hasBar ? 'default' : 'crosshair',
        backgroundImage: `repeating-linear-gradient(
          to right,
          transparent,
          transparent ${ppd - 1}px,
          hsl(var(--border) / 0.3) ${ppd - 1}px,
          hsl(var(--border) / 0.3) ${ppd}px
        )`,
      }}
      onPointerDown={handleRowPointerDown}
    >
      {/* ドラッグ作成プレビュー */}
      <div
        ref={previewRef}
        className="pointer-events-none absolute top-[6px] rounded-md border border-blue-500 bg-blue-400/50"
        style={{ display: 'none', height: ROW_HEIGHT - 12 }}
      />
      {tasks.map((t) => (
        <GanttBar
          key={t.id}
          task={t}
          ganttStart={ganttStart}
          scale={scale}
          onBarPointerDown={onBarPointerDown}
          onClick={onBarClick}
        />
      ))}
    </div>
  )
})
