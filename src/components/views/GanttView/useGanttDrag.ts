import { useRef, useState, useCallback } from 'react'
import { addDays, startOfDay, differenceInDays } from 'date-fns'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY } from './ganttConstants'
import { taskRepo } from '@/repositories'

type Handle = 'move' | 'left' | 'right'

interface DragState {
  taskId: string
  handle: Handle
  startX: number
  ppd: number // ドラッグ開始時点のスケールを固定（#2: スケール変更時のずれ防止）
  originalStartDate: Date | null
  originalDueDate: Date | null
  previewStartDate: Date | null
  previewDueDate: Date | null
}

interface GanttDragResult {
  preview: Map<string, { startDate: Date | null; dueDate: Date | null }>
  onBarPointerDown: (e: React.PointerEvent, task: Task, handle: Handle) => void
}

export function useGanttDrag(ganttStart: Date, scale: GanttScale): GanttDragResult {
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<
    Map<string, { startDate: Date | null; dueDate: Date | null }>
  >(new Map())

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    const dx = e.clientX - drag.startX
    // #2: ドラッグ開始時点の ppd を使用（スケール変更の影響を受けない）
    const daysDelta = Math.round(dx / drag.ppd)

    let newStartDate = drag.originalStartDate
    let newDueDate = drag.originalDueDate

    if (drag.handle === 'move') {
      newStartDate = drag.originalStartDate ? addDays(drag.originalStartDate, daysDelta) : null
      newDueDate = drag.originalDueDate ? addDays(drag.originalDueDate, daysDelta) : null
    } else if (drag.handle === 'left') {
      if (drag.originalStartDate) {
        const candidate = addDays(drag.originalStartDate, daysDelta)
        const due = drag.originalDueDate ?? drag.originalStartDate
        newStartDate = candidate <= due ? candidate : due
      }
    } else if (drag.handle === 'right') {
      if (drag.originalDueDate) {
        const candidate = addDays(drag.originalDueDate, daysDelta)
        const start = drag.originalStartDate ?? drag.originalDueDate
        newDueDate = candidate >= start ? candidate : start
      }
    }

    drag.previewStartDate = newStartDate
    drag.previewDueDate = newDueDate

    setPreview(new Map([[drag.taskId, { startDate: newStartDate, dueDate: newDueDate }]]))
  }, []) // ppd は dragRef に閉じ込めたため依存配列不要

  const onPointerUp = useCallback(async () => {
    const drag = dragRef.current
    if (!drag) return

    const { taskId, previewStartDate, previewDueDate, originalStartDate, originalDueDate } = drag
    dragRef.current = null
    setPreview(new Map())

    const startChanged = previewStartDate?.getTime() !== originalStartDate?.getTime()
    const dueChanged = previewDueDate?.getTime() !== originalDueDate?.getTime()
    if (!startChanged && !dueChanged) return

    const patch: { startDate?: Date | null; dueDate?: Date | null } = {}
    if (startChanged) patch.startDate = previewStartDate
    if (dueChanged) patch.dueDate = previewDueDate

    await taskRepo.update(taskId, patch)
  }, [])

  const onBarPointerDown = useCallback(
    (e: React.PointerEvent, task: Task, handle: Handle) => {
      e.preventDefault()
      // #1: e.currentTarget でキャプチャ元を確実に取得
      const target = e.currentTarget as Element
      target.setPointerCapture(e.pointerId)

      dragRef.current = {
        taskId: task.id,
        handle,
        startX: e.clientX,
        ppd: PIXELS_PER_DAY[scale], // #2: 開始時のスケールを確定
        originalStartDate: task.startDate ? startOfDay(task.startDate) : null,
        originalDueDate: task.dueDate ? startOfDay(task.dueDate) : null,
        previewStartDate: task.startDate,
        previewDueDate: task.dueDate,
      }

      const handleMove = (ev: PointerEvent) => onPointerMove(ev)
      const handleUp = async () => {
        await onPointerUp()
        target.removeEventListener('pointermove', handleMove)
        target.removeEventListener('pointerup', handleUp)
        target.removeEventListener('pointercancel', handleCancel) // #1
      }
      // #1: pointercancel でドラッグ状態を確実にリセット（タッチスクロール割り込み等）
      const handleCancel = () => {
        dragRef.current = null
        setPreview(new Map())
        target.removeEventListener('pointermove', handleMove)
        target.removeEventListener('pointerup', handleUp)
        target.removeEventListener('pointercancel', handleCancel)
      }

      target.addEventListener('pointermove', handleMove)
      target.addEventListener('pointerup', handleUp)
      target.addEventListener('pointercancel', handleCancel)
    },
    [scale, onPointerMove, onPointerUp]
  )

  return { preview, onBarPointerDown }
}

// ガントの表示範囲を計算するユーティリティ（GanttView で使用）
export function calcGanttRange(rows: { tasks: Task[] }[]): { startDate: Date; totalDays: number } {
  // #10: today を先頭に入れることで「今日を必ず含める」と「reduce が空配列でクラッシュしない」の両方を保証
  const allDates: Date[] = [startOfDay(new Date())]
  for (const row of rows) {
    for (const task of row.tasks) {
      if (task.startDate) allDates.push(startOfDay(task.startDate))
      if (task.dueDate) allDates.push(startOfDay(task.dueDate))
    }
  }

  const minDate = allDates.reduce((min, d) => (d < min ? d : min))
  const maxDate = allDates.reduce((max, d) => (d > max ? d : max))

  const start = addDays(minDate, -7)
  const end = addDays(maxDate, 14)
  const totalDays = differenceInDays(end, start) + 1

  return { startDate: start, totalDays }
}
