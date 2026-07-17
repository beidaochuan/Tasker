import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Clock, FolderOpen, GripVertical, Plus } from 'lucide-react'
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
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { taskRepo } from '@/repositories'
import { resolveTaskId } from '@/utils/recurrenceUtils'
import { useGanttData } from '@/hooks/useGanttData'
import { GanttHeader } from './GanttHeader'
import { GanttDayBackground } from './GanttDayBackground'
import { GanttRow } from './GanttRow'
import { GanttTodayLine } from './GanttTodayLine'
import { useGanttDrag, calcGanttRange } from './useGanttDrag'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT, HEADER_HEIGHT, LEFT_PANE_WIDTH } from './ganttConstants'
import {
  applyGanttPreview,
  applyGanttTaskOrder,
  projectGanttRows,
  type GanttTaskFlatRow,
  type GanttTaskOrder,
} from './ganttRowModel'
import type { Task } from '@/types'
import {
  PRIORITY_LABELS,
  PRIORITY_TEXT_CLASSES,
  STATUS_BACKGROUND_CLASSES,
  STATUS_LABELS,
} from '@/utils/taskPresentation'
import { unwrapResult } from '@/utils/resultUtils'
import { getOverdueDays } from '@/utils/dateUtils'

const SCALE_LABELS: Record<GanttScale, string> = {
  day: '日',
  week: '週',
  month: '月',
}

const MIN_DAYS: Record<GanttScale, number> = { day: 30, week: 90, month: 365 }

const TOPIC_ROW_HEIGHT = 28

interface SortableTaskLabelProps {
  row: GanttTaskFlatRow
  top: number
  height: number
  disabled: boolean
  animatePosition: boolean
  onTaskClick: (taskId: string) => void
}

function SortableTaskLabel({
  row,
  top,
  height,
  disabled,
  animatePosition,
  onTaskClick,
}: SortableTaskLabelProps) {
  const task = row.task
  const overdueDays = task.status === 'done' ? 0 : getOverdueDays(task.dueDate)
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: task.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`group/gantt-task absolute left-0 right-0 flex items-center border-b border-border pl-1 text-sm text-foreground ${
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
      <button
        type="button"
        onClick={() => onTaskClick(resolveTaskId(task.id))}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center rounded-md pr-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`${row.label}を編集`}
      >
        <span
          className={`font-soft mr-1.5 inline-flex h-5 shrink-0 items-center rounded bg-muted px-1 text-[10px] font-medium leading-none ${PRIORITY_TEXT_CLASSES[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {overdueDays > 0 && (
          <span
            className="ml-1.5 inline-flex h-5 shrink-0 items-center gap-1 rounded bg-danger/10 px-1.5 text-[10px] font-semibold leading-none text-danger ring-1 ring-inset ring-danger/25"
            title={`期限を${overdueDays}日超過`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {overdueDays}日超過
          </span>
        )}
      </button>
    </div>
  )
}

export function GanttView() {
  const {
    selectedProjectId,
    openTaskDrawer,
    openNewTaskDrawer,
    expandedCompletedTopicIds,
    toggleCompletedTasks,
  } = useUIStore()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const ganttRows = useGanttData(selectedProjectId)
  const [scale, setScale] = useState<GanttScale>('day')
  const [pendingTaskOrder, setPendingTaskOrder] = useState<GanttTaskOrder | null>(null)
  const [dragTaskOrder, setDragTaskOrder] = useState<GanttTaskOrder | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const dragTaskOrderRef = useRef<GanttTaskOrder | null>(null)
  const dragStartTaskOrderRef = useRef<GanttTaskOrder | null>(null)
  const lastDragOverIdRef = useRef<string | number | null>(null)
  const reorderingRef = useRef(false)
  const invalidateProjectTasks = useDataQueryStore((state) => state.invalidateProjectTasks)
  const updateProjectTask = useDataQueryStore((state) => state.updateProjectTask)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const ppd = PIXELS_PER_DAY[scale]

  const {
    allRows: allFlatRows,
    visibleRows: flatRows,
    rangeRows: visibleGanttRows,
  } = useMemo(
    () => projectGanttRows(ganttRows, expandedCompletedTopicIds),
    [expandedCompletedTopicIds, ganttRows]
  )

  const { startDate, totalDays } = useMemo(() => {
    const range = visibleGanttRows.some(({ tasks }) => tasks.length > 0)
      ? calcGanttRange(visibleGanttRows)
      : { startDate: new Date(), totalDays: 60 }
    return { startDate: range.startDate, totalDays: Math.max(range.totalDays, MIN_DAYS[scale]) }
  }, [scale, visibleGanttRows])

  const { preview, clearPreview, onBarPointerDown } = useGanttDrag(
    startDate,
    scale,
    selectedProjectId
  )

  const handleCreateBar = useCallback(
    async (taskId: string, startDate: Date, dueDate: Date) => {
      if (!isAuthenticated) return
      const updatedTask = unwrapResult(
        await taskRepo.update(resolveTaskId(taskId), { startDate, dueDate, status: 'todo' })
      )
      if (selectedProjectId) {
        updateProjectTask(selectedProjectId, updatedTask)
        invalidateProjectTasks(selectedProjectId)
      }
    },
    [invalidateProjectTasks, isAuthenticated, selectedProjectId, updateProjectTask]
  )

  const orderedFlatRows = useMemo(
    () => applyGanttTaskOrder(flatRows, dragTaskOrder ?? pendingTaskOrder),
    [dragTaskOrder, flatRows, pendingTaskOrder]
  )

  useEffect(() => {
    if (!pendingTaskOrder) return
    const topicExists = allFlatRows.some(
      (row) => row.type === 'topic' && row.topicId === pendingTaskOrder.topicId
    )
    const savedTaskIds = allFlatRows
      .filter(
        (row): row is GanttTaskFlatRow =>
          row.type === 'task-row' && row.topicId === pendingTaskOrder.topicId
      )
      .map((row) => row.task.id)
    const isSettled =
      savedTaskIds.length === pendingTaskOrder.taskIds.length &&
      savedTaskIds.every((id, index) => id === pendingTaskOrder.taskIds[index])
    if (!topicExists || isSettled) setPendingTaskOrder(null)
  }, [allFlatRows, pendingTaskOrder])

  const sortableTaskIds = useMemo(
    () =>
      orderedFlatRows
        .filter((row): row is GanttTaskFlatRow => row.type === 'task-row')
        .map((row) => row.task.id),
    [orderedFlatRows]
  )

  const handleTaskDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const row = orderedFlatRows.find(
        (item): item is GanttTaskFlatRow => item.type === 'task-row' && item.task.id === active.id
      )
      setDraggingLabel(row?.label ?? null)
      if (!row) return

      const savedTaskOrder =
        pendingTaskOrder?.topicId === row.topicId
          ? pendingTaskOrder.taskIds
          : allFlatRows
              .filter(
                (item): item is GanttTaskFlatRow =>
                  item.type === 'task-row' && item.topicId === row.topicId
              )
              .map((item) => item.task.id)
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

      const activeRow = orderedFlatRows.find(
        (row): row is GanttTaskFlatRow => row.type === 'task-row' && row.task.id === active.id
      )
      const overRow = orderedFlatRows.find(
        (row): row is GanttTaskFlatRow => row.type === 'task-row' && row.task.id === over.id
      )
      if (
        !activeRow ||
        !overRow ||
        (activeRow.task.status === 'done') !== (overRow.task.status === 'done')
      ) {
        return
      }

      const visibleTaskIdSet = new Set(
        orderedFlatRows
          .filter(
            (row): row is GanttTaskFlatRow =>
              row.type === 'task-row' &&
              row.topicId === currentOrder.topicId &&
              (row.task.status === 'done') === (activeRow.task.status === 'done')
          )
          .map((row) => row.task.id)
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
    async ({ active, over }: DragEndEvent) => {
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
      const activeRow = orderedFlatRows.find(
        (row): row is GanttTaskFlatRow => row.type === 'task-row' && row.task.id === active.id
      )
      const overRow = orderedFlatRows.find(
        (row): row is GanttTaskFlatRow => row.type === 'task-row' && row.task.id === over.id
      )
      const droppedInSameGroup =
        activeRow !== undefined &&
        overRow !== undefined &&
        activeRow.topicId === overRow.topicId &&
        (activeRow.task.status === 'done') === (overRow.task.status === 'done')
      const droppedInTopic = taskOrder.taskIds.some((id) => id === over.id)
      const orderChanged = taskOrder.taskIds.some(
        (id, index) => id !== startTaskOrder.taskIds[index]
      )
      if (!droppedInSameGroup || !droppedInTopic || !orderChanged) return

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
        if (selectedProjectId) invalidateProjectTasks(selectedProjectId)
      } catch (error) {
        console.error('ガントのタスク並び替えに失敗しました', error)
        setPendingTaskOrder(null)
        if (selectedProjectId) invalidateProjectTasks(selectedProjectId)
      } finally {
        reorderingRef.current = false
        setIsReordering(false)
      }
    },
    [invalidateProjectTasks, isAuthenticated, orderedFlatRows, selectedProjectId]
  )

  // 左右ペインで同じpreview結果を使い、仮想行ごとの重複計算を避ける。
  const displayedFlatRows = useMemo(
    () => applyGanttPreview(orderedFlatRows, preview),
    [orderedFlatRows, preview]
  )

  useEffect(() => {
    if (preview.size === 0) return

    const tasksById = new Map<string, Task>()
    for (const row of allFlatRows) {
      if (row.type !== 'task-row') continue
      tasksById.set(row.task.id, row.task)
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

  // フラグを次フレームで解除し、左右ペインの相互scrollイベントを抑える。
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
    estimateSize: (i) => (orderedFlatRows[i].type === 'task-row' ? ROW_HEIGHT : TOPIC_ROW_HEIGHT),
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
        </div>
        <div className="hidden items-center gap-5 text-xs text-muted-foreground lg:flex">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold">状態</span>
            {(['todo', 'in_progress', 'done'] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${STATUS_BACKGROUND_CLASSES[status]}`} />
                {STATUS_LABELS[status]}
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
                        key={row.task.id}
                        row={row}
                        top={vi.start}
                        height={vi.size}
                        disabled={!isAuthenticated || isReordering}
                        animatePosition={dragTaskOrder !== null}
                        onTaskClick={openTaskDrawer}
                      />
                    )
                  }
                  if (row.type === 'completed-group') {
                    const isOpen = expandedCompletedTopicIds[row.topicId] ?? false
                    return (
                      <button
                        key={`completed-${row.topicId}`}
                        type="button"
                        onClick={() => toggleCompletedTasks(row.topicId)}
                        disabled={isReordering || dragTaskOrder !== null}
                        aria-expanded={isOpen}
                        className="absolute left-0 right-0 flex items-center gap-1.5 border-b border-border bg-muted/35 px-3 text-left text-xs font-medium text-muted-foreground opacity-60 transition-colors hover:bg-muted/60 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ top: vi.start, height: vi.size }}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{row.label}</span>
                      </button>
                    )
                  }
                  return (
                    <div
                      key={`topic-${row.topicId}`}
                      className="absolute left-0 right-0 flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 text-xs font-semibold text-muted-foreground"
                      style={{ top: vi.start, height: vi.size }}
                    >
                      <span className="truncate">{row.label}</span>
                      {isAuthenticated && (
                        <button
                          type="button"
                          onClick={() => openNewTaskDrawer(row.topicId)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                          title="タスクを追加"
                          aria-label={`${row.label} にタスクを追加`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
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
              <GanttDayBackground startDate={startDate} totalDays={totalDays} scale={scale} />
              <GanttTodayLine ganttStart={startDate} totalDays={totalDays} scale={scale} />

              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = displayedFlatRows[vi.index]
                if (row.type !== 'task-row') {
                  return (
                    <div
                      key={`${row.type}-${row.topicId}`}
                      className={`absolute left-0 right-0 border-b border-border ${
                        row.type === 'topic' ? 'bg-muted/40' : 'bg-muted/20'
                      }`}
                      style={{ top: vi.start, height: vi.size, width: totalWidth }}
                    />
                  )
                }
                return (
                  <div
                    key={row.task.id}
                    className="absolute left-0"
                    style={{
                      top: vi.start,
                      height: vi.size,
                      width: totalWidth,
                      transition: dragTaskOrder ? 'top 250ms ease' : undefined,
                    }}
                  >
                    <GanttRow
                      task={row.task}
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
