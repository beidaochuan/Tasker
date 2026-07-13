import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { FolderOpen, GripVertical } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { taskRepo } from '@/repositories'
import { resolveTaskId } from '@/utils/recurrenceUtils'
import { useGanttData } from '@/hooks/useGanttData'
import { GanttHeader } from './GanttHeader'
import { GanttRow } from './GanttRow'
import { GanttTodayLine } from './GanttTodayLine'
import { useGanttDrag, calcGanttRange } from './useGanttDrag'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT, HEADER_HEIGHT, LEFT_PANE_WIDTH } from './ganttConstants'
import type { Task } from '@/types'
import { PRIORITY_DOT_CLASSES, PRIORITY_LABELS, STATUS_LABELS } from '@/utils/taskPresentation'
import { unwrapResult } from '@/utils/resultUtils'

const SCALE_LABELS: Record<GanttScale, string> = {
  day: '日',
  week: '週',
  month: '月',
}

const MIN_DAYS: Record<GanttScale, number> = { day: 30, week: 90, month: 365 }

const TOPIC_ROW_HEIGHT = 28

interface FlatRow {
  type: 'topic' | 'task-row'
  label: string
  tasks: Task[] // task-row の場合は必ず1要素
  topicId: string
}

interface PendingTaskOrder {
  topicId: string
  taskIds: string[]
}

interface SortableTaskLabelProps {
  row: FlatRow
  top: number
  height: number
  disabled: boolean
  animatePosition: boolean
}

function SortableTaskLabel({
  row,
  top,
  height,
  disabled,
  animatePosition,
}: SortableTaskLabelProps) {
  const task = row.tasks[0]
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: task.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`group/gantt-task absolute left-0 right-0 flex items-center border-b border-border pl-1 pr-3 text-sm text-foreground ${
        isDragging ? 'opacity-30' : ''
      }`}
      style={{ top, height, transition: animatePosition ? 'top 250ms ease' : undefined }}
    >
      <button
        {...(disabled ? {} : { ...attributes, ...listeners })}
        className={`flex h-full w-5 shrink-0 touch-none items-center justify-center text-muted-foreground transition-opacity ${
          disabled
            ? 'invisible'
            : 'cursor-grab opacity-0 group-hover/gantt-task:opacity-100 focus:opacity-100 active:cursor-grabbing'
        }`}
        aria-label={`${row.label}をドラッグして並べ替え`}
        tabIndex={disabled ? -1 : 0}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="truncate">{row.label}</span>
    </div>
  )
}

export function GanttView() {
  const { selectedProjectId, openTaskDrawer } = useUIStore()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const ganttRows = useGanttData(selectedProjectId)
  const [scale, setScale] = useState<GanttScale>('day')
  const [showCompleted, setShowCompleted] = useState(false)
  const [pendingTaskOrder, setPendingTaskOrder] = useState<PendingTaskOrder | null>(null)
  const [dragTaskOrder, setDragTaskOrder] = useState<PendingTaskOrder | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const dragTaskOrderRef = useRef<PendingTaskOrder | null>(null)
  const dragStartTaskOrderRef = useRef<PendingTaskOrder | null>(null)
  const lastDragOverIdRef = useRef<string | number | null>(null)
  const reorderingRef = useRef(false)
  const refresh = useRefreshStore((s) => s.refresh)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const ppd = PIXELS_PER_DAY[scale]

  const completedTaskCount = useMemo(
    () =>
      ganttRows.reduce(
        (count, { tasks }) => count + tasks.filter((task) => task.status === 'done').length,
        0
      ),
    [ganttRows]
  )

  const visibleGanttRows = useMemo(
    () =>
      ganttRows.map(({ topic, tasks }) => ({
        topic,
        tasks: showCompleted ? tasks : tasks.filter((task) => task.status !== 'done'),
      })),
    [ganttRows, showCompleted]
  )

  const { startDate, totalDays } = useMemo(() => {
    const range = visibleGanttRows.some(({ tasks }) => tasks.length > 0)
      ? calcGanttRange(visibleGanttRows)
      : { startDate: new Date(), totalDays: 60 }
    return { startDate: range.startDate, totalDays: Math.max(range.totalDays, MIN_DAYS[scale]) }
  }, [scale, visibleGanttRows])

  const { preview, clearPreview, onBarPointerDown } = useGanttDrag(startDate, scale)

  const handleCreateBar = useCallback(
    async (taskId: string, startDate: Date, dueDate: Date) => {
      if (!isAuthenticated) return
      unwrapResult(
        await taskRepo.update(resolveTaskId(taskId), { startDate, dueDate, status: 'todo' })
      )
      refresh()
    },
    [isAuthenticated, refresh]
  )

  const allFlatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const { topic, tasks } of ganttRows) {
      rows.push({ type: 'topic', label: topic.name, tasks: [], topicId: topic.id })
      for (const task of tasks) {
        rows.push({ type: 'task-row', label: task.title, tasks: [task], topicId: topic.id })
      }
    }
    return rows
  }, [ganttRows])

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const { topic, tasks } of visibleGanttRows) {
      rows.push({ type: 'topic', label: topic.name, tasks: [], topicId: topic.id })
      for (const task of tasks) {
        rows.push({ type: 'task-row', label: task.title, tasks: [task], topicId: topic.id })
      }
    }
    return rows
  }, [visibleGanttRows])

  const orderedFlatRows = useMemo<FlatRow[]>(() => {
    const taskOrder = dragTaskOrder ?? pendingTaskOrder
    if (!taskOrder) return flatRows

    const orderById = new Map(taskOrder.taskIds.map((id, index) => [id, index]))
    const orderedTopicRows = flatRows
      .filter((row) => row.type === 'task-row' && row.topicId === taskOrder.topicId)
      .sort((a, b) => {
        const aOrder = orderById.get(a.tasks[0].id) ?? Number.MAX_SAFE_INTEGER
        const bOrder = orderById.get(b.tasks[0].id) ?? Number.MAX_SAFE_INTEGER
        return aOrder - bOrder
      })
    let taskIndex = 0

    return flatRows.map((row) => {
      if (row.type !== 'task-row' || row.topicId !== taskOrder.topicId) return row
      return orderedTopicRows[taskIndex++] ?? row
    })
  }, [dragTaskOrder, flatRows, pendingTaskOrder])

  useEffect(() => {
    if (!pendingTaskOrder) return
    const topicExists = allFlatRows.some(
      (row) => row.type === 'topic' && row.topicId === pendingTaskOrder.topicId
    )
    const savedTaskIds = allFlatRows
      .filter((row) => row.type === 'task-row' && row.topicId === pendingTaskOrder.topicId)
      .map((row) => row.tasks[0].id)
    const isSettled =
      savedTaskIds.length === pendingTaskOrder.taskIds.length &&
      savedTaskIds.every((id, index) => id === pendingTaskOrder.taskIds[index])
    if (!topicExists || isSettled) setPendingTaskOrder(null)
  }, [allFlatRows, pendingTaskOrder])

  const sortableTaskIds = useMemo(
    () => orderedFlatRows.filter((row) => row.type === 'task-row').map((row) => row.tasks[0].id),
    [orderedFlatRows]
  )

  const handleTaskDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const row = orderedFlatRows.find(
        (item) => item.type === 'task-row' && item.tasks[0].id === active.id
      )
      setDraggingLabel(row?.label ?? null)
      if (!row) return

      const savedTaskOrder =
        pendingTaskOrder?.topicId === row.topicId
          ? pendingTaskOrder.taskIds
          : allFlatRows
              .filter((item) => item.type === 'task-row' && item.topicId === row.topicId)
              .map((item) => item.tasks[0].id)
      const taskOrder = {
        topicId: row.topicId,
        taskIds: savedTaskOrder,
      }
      dragStartTaskOrderRef.current = taskOrder
      dragTaskOrderRef.current = taskOrder
      lastDragOverIdRef.current = null
      setDragTaskOrder(taskOrder)
    },
    [allFlatRows, orderedFlatRows, pendingTaskOrder]
  )

  const handleTaskDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const currentOrder = dragTaskOrderRef.current
      if (!currentOrder || !over) return
      if (active.id === over.id) {
        lastDragOverIdRef.current = active.id
        return
      }
      if (lastDragOverIdRef.current === over.id) return
      lastDragOverIdRef.current = over.id

      const visibleTaskIdSet = new Set(
        orderedFlatRows
          .filter((row) => row.type === 'task-row' && row.topicId === currentOrder.topicId)
          .map((row) => row.tasks[0].id)
      )
      const visibleTaskIds = currentOrder.taskIds.filter((id) => visibleTaskIdSet.has(id))
      const fromIndex = visibleTaskIds.findIndex((id) => id === active.id)
      const toIndex = visibleTaskIds.findIndex((id) => id === over.id)
      if (fromIndex < 0 || toIndex < 0) return

      const reorderedVisibleTaskIds = [...visibleTaskIds]
      const [movedId] = reorderedVisibleTaskIds.splice(fromIndex, 1)
      reorderedVisibleTaskIds.splice(toIndex, 0, movedId)
      let visibleIndex = 0
      const taskIds = currentOrder.taskIds.map((id) =>
        visibleTaskIdSet.has(id) ? reorderedVisibleTaskIds[visibleIndex++] : id
      )
      const nextOrder = { ...currentOrder, taskIds }
      dragTaskOrderRef.current = nextOrder
      setDragTaskOrder(nextOrder)
    },
    [orderedFlatRows]
  )

  const handleTaskDragCancel = useCallback(() => {
    dragTaskOrderRef.current = null
    dragStartTaskOrderRef.current = null
    lastDragOverIdRef.current = null
    setDragTaskOrder(null)
    setDraggingLabel(null)
  }, [])

  const handleTaskDragEnd = useCallback(
    async ({ over }: DragEndEvent) => {
      const taskOrder = dragTaskOrderRef.current
      const startTaskOrder = dragStartTaskOrderRef.current
      dragTaskOrderRef.current = null
      dragStartTaskOrderRef.current = null
      lastDragOverIdRef.current = null
      setDragTaskOrder(null)
      setDraggingLabel(null)
      if (!isAuthenticated || reorderingRef.current || !over || !taskOrder || !startTaskOrder) {
        return
      }
      const droppedInTopic = taskOrder.taskIds.some((id) => id === over.id)
      const orderChanged = taskOrder.taskIds.some(
        (id, index) => id !== startTaskOrder.taskIds[index]
      )
      if (!droppedInTopic || !orderChanged) return

      setPendingTaskOrder(taskOrder)
      reorderingRef.current = true
      setIsReordering(true)
      try {
        unwrapResult(
          await taskRepo.updateGanttOrder(
            taskOrder.taskIds.map((taskId, ganttOrder) => ({
              id: resolveTaskId(taskId),
              ganttOrder,
            }))
          )
        )
        refresh()
      } catch (error) {
        console.error('ガントのタスク並び替えに失敗しました', error)
        setPendingTaskOrder(null)
        refresh()
      } finally {
        reorderingRef.current = false
        setIsReordering(false)
      }
    },
    [isAuthenticated, refresh]
  )

  // #7: preview 適用をここで一括計算（仮想アイテムのレンダリング内で毎回走らせない）
  const displayedFlatRows = useMemo<FlatRow[]>(() => {
    if (preview.size === 0) return orderedFlatRows
    return orderedFlatRows.map((row) => {
      if (row.type === 'topic') return row
      let hasPreview = false
      const tasks = row.tasks.map((task) => {
        const p = preview.get(task.id)
        if (p) hasPreview = true
        return p ? { ...task, ...p } : task
      })
      return hasPreview ? { ...row, tasks } : row
    })
  }, [orderedFlatRows, preview])

  useEffect(() => {
    if (preview.size === 0) return

    const tasksById = new Map<string, Task>()
    for (const row of allFlatRows) {
      if (row.type !== 'task-row') continue
      for (const task of row.tasks) tasksById.set(task.id, task)
    }

    const isSettled = [...preview].every(([taskId, dates]) => {
      const task = tasksById.get(taskId)
      return (
        task &&
        task.startDate?.getTime() === dates.startDate?.getTime() &&
        task.dueDate?.getTime() === dates.dueDate?.getTime()
      )
    })

    if (isSettled) clearPreview()
  }, [allFlatRows, clearPreview, preview])

  // 縦スクロール同期用 refs
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  // #3: requestAnimationFrame でフラグリセットを次フレームに遅延させ、連続スクロールでのスタッター防止
  const syncLeft = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    requestAnimationFrame(() => {
      if (rightScrollRef.current && leftScrollRef.current) {
        rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop
      }
      syncingRef.current = false
    })
  }, [])

  const syncRight = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    requestAnimationFrame(() => {
      if (leftScrollRef.current && rightScrollRef.current) {
        leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop
      }
      syncingRef.current = false
    })
  }, [])

  // TanStack Virtual exposes imperative methods that React Compiler intentionally skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: orderedFlatRows.length,
    getScrollElement: () => rightScrollRef.current,
    estimateSize: (i) => (orderedFlatRows[i].type === 'topic' ? TOPIC_ROW_HEIGHT : ROW_HEIGHT),
    overscan: 5,
    scrollPaddingStart: HEADER_HEIGHT,
  })

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  const totalWidth = totalDays * ppd

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* スケール切替ツールバー */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 py-2.5">
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-muted-foreground">スケール:</span>
          {(['day', 'week', 'month'] as GanttScale[]).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                scale === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {SCALE_LABELS[s]}
            </button>
          ))}
          <label
            className={`ml-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground ${
              isReordering || dragTaskOrder !== null
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={showCompleted}
              disabled={isReordering || dragTaskOrder !== null}
              onChange={(event) => setShowCompleted(event.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            完了を表示（{completedTaskCount}）
          </label>
        </div>
        <div className="hidden items-center gap-5 text-xs text-muted-foreground lg:flex">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold">状態</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              {STATUS_LABELS.todo}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {STATUS_LABELS.in_progress}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {STATUS_LABELS.done}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold">優先度</span>
            {(['urgent', 'high', 'medium', 'low'] as const).map((priority) => (
              <span key={priority} className="flex items-center gap-1.5">
                <span className={`h-3 w-1.5 rounded-sm ${PRIORITY_DOT_CLASSES[priority]}`} />
                {PRIORITY_LABELS[priority]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* メインエリア（左ペイン + 右ペイン） */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleTaskDragStart}
        onDragOver={handleTaskDragOver}
        onDragEnd={handleTaskDragEnd}
        onDragCancel={handleTaskDragCancel}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* 左ペイン: タスク名リスト */}
          <div
            className="relative shrink-0 overflow-y-auto overflow-x-hidden border-r border-border"
            ref={leftScrollRef}
            style={{ width: LEFT_PANE_WIDTH }}
            onScroll={syncLeft}
          >
            <div
              className="sticky top-0 z-10 border-b border-border bg-card"
              style={{ height: HEADER_HEIGHT }}
            />
            <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const row = orderedFlatRows[vi.index]
                  if (row.type === 'task-row') {
                    return (
                      <SortableTaskLabel
                        key={row.tasks[0].id}
                        row={row}
                        top={vi.start}
                        height={vi.size}
                        disabled={!isAuthenticated || isReordering}
                        animatePosition={dragTaskOrder !== null}
                      />
                    )
                  }
                  return (
                    <div
                      key={`topic-${row.topicId}`}
                      className="absolute left-0 right-0 flex items-center border-b border-border bg-muted/60 px-3 text-xs font-semibold text-muted-foreground"
                      style={{ top: vi.start, height: vi.size }}
                    >
                      <span className="truncate">{row.label}</span>
                    </div>
                  )
                })}
              </div>
            </SortableContext>
          </div>

          {/* 右ペイン: タイムライン（ヘッダー + 本体を同一スクロールコンテナに入れ横スクロールを同期） */}
          <div ref={rightScrollRef} className="flex-1 overflow-auto" onScroll={syncRight}>
            {/* sticky ヘッダー: 縦スクロールで固定、横は本体と同期 */}
            <div className="sticky top-0 z-10" style={{ width: totalWidth, height: HEADER_HEIGHT }}>
              <GanttHeader startDate={startDate} totalDays={totalDays} scale={scale} />
            </div>

            <div
              className="relative"
              style={{ width: totalWidth, height: rowVirtualizer.getTotalSize() }}
            >
              <GanttTodayLine ganttStart={startDate} totalDays={totalDays} scale={scale} />

              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = displayedFlatRows[vi.index]
                if (row.type === 'topic') {
                  return (
                    <div
                      key={`topic-${row.topicId}`}
                      className="absolute left-0 right-0 border-b border-border bg-muted/40"
                      style={{ top: vi.start, height: vi.size, width: totalWidth }}
                    />
                  )
                }
                return (
                  <div
                    key={row.tasks[0].id}
                    className="absolute left-0"
                    style={{
                      top: vi.start,
                      height: vi.size,
                      width: totalWidth,
                      transition: dragTaskOrder ? 'top 250ms ease' : undefined,
                    }}
                  >
                    <GanttRow
                      tasks={row.tasks}
                      totalDays={totalDays}
                      ganttStart={startDate}
                      scale={scale}
                      onBarPointerDown={isAuthenticated ? onBarPointerDown : undefined}
                      onBarClick={openTaskDrawer}
                      onCreateBar={isAuthenticated ? handleCreateBar : undefined}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <DragOverlay>
          {draggingLabel && (
            <div
              className="flex items-center border border-border bg-card px-6 text-sm text-foreground shadow-lg"
              style={{ width: LEFT_PANE_WIDTH, height: ROW_HEIGHT }}
            >
              <span className="truncate">{draggingLabel}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default GanttView
