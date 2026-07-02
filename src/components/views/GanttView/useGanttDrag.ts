import { useRef, useState, useCallback } from 'react'
import { addDays, startOfDay, differenceInDays } from 'date-fns'
import type { Task } from '@/types'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY } from './ganttConstants'
import { taskRepo } from '@/repositories'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { resolveTaskId } from '@/utils/recurrenceUtils'
import { unwrapResult } from '@/utils/resultUtils'

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
  onBarPointerDown: (
    e: React.PointerEvent,
    task: Task,
    handle: Handle,
    element: HTMLElement
  ) => void
}

export function useGanttDrag(_ganttStart: Date, scale: GanttScale): GanttDragResult {
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<
    Map<string, { startDate: Date | null; dueDate: Date | null }>
  >(new Map())
  const refresh = useRefreshStore((s) => s.refresh)

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
      const baseStart = drag.originalStartDate ?? drag.originalDueDate
      if (baseStart) {
        const candidate = addDays(baseStart, daysDelta)
        const due = drag.originalDueDate ?? baseStart
        newStartDate = candidate <= due ? candidate : due
      }
    } else if (drag.handle === 'right') {
      const baseDue = drag.originalDueDate ?? drag.originalStartDate
      if (baseDue) {
        const candidate = addDays(baseDue, daysDelta)
        const start = drag.originalStartDate ?? baseDue
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

    unwrapResult(await taskRepo.update(taskId, patch))
    refresh()
  }, [refresh])

  const onBarPointerDown = useCallback(
    (e: React.PointerEvent, task: Task, handle: Handle, _element: HTMLElement) => {
      e.preventDefault()

      dragRef.current = {
        taskId: resolveTaskId(task.id),
        handle,
        startX: e.clientX,
        ppd: PIXELS_PER_DAY[scale],
        originalStartDate: task.startDate ? startOfDay(task.startDate) : null,
        originalDueDate: task.dueDate ? startOfDay(task.dueDate) : null,
        previewStartDate: task.startDate,
        previewDueDate: task.dueDate,
      }

      const handleMove = (ev: PointerEvent) => onPointerMove(ev)
      const cleanup = async (ev?: PointerEvent) => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', cleanup)
        window.removeEventListener('pointercancel', cleanup)
        if (ev?.type === 'pointercancel') {
          dragRef.current = null
          setPreview(new Map())
        } else {
          try {
            await onPointerUp()
          } catch (err) {
            console.error('ガントバーの更新に失敗しました', err)
          }
        }
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', cleanup)
      window.addEventListener('pointercancel', cleanup)
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
