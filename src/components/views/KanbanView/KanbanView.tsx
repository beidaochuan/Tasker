import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core'
import { FolderOpen } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCardContent } from './KanbanCardContent'
import { KanbanSkeleton } from '@/components/ui/skeleton'
import { COLUMN_ORDER, WIP_LIMITS } from './kanbanConstants'
import { useKanbanData } from '@/hooks/useTasks'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { taskRepo } from '@/repositories'
import { unwrapResult } from '@/utils/resultUtils'
import { sortKanbanColumnTasks } from '@/utils/sortUtils'
import type { Task, TaskStatus } from '@/types'

type TasksByStatus = Record<TaskStatus, Task[]>

interface LocalBoard {
  projectId: string
  tasksByStatus: TasksByStatus
}

function findColumnOfTask(taskId: string, tasksByStatus: TasksByStatus): TaskStatus | null {
  for (const col of COLUMN_ORDER) {
    if (tasksByStatus[col].some((t) => t.id === taskId)) return col
  }
  return null
}

function resolveTargetColumn(
  overId: string | null,
  tasksByStatus: TasksByStatus
): TaskStatus | null {
  if (!overId) return null
  // over.id が列ID (TaskStatus) の場合
  if (COLUMN_ORDER.includes(overId as TaskStatus)) return overId as TaskStatus
  // over.id がカードID の場合: そのカードが属する列を返す
  return findColumnOfTask(overId, tasksByStatus)
}

export function KanbanView() {
  const { selectedProjectId } = useUIStore()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const invalidateProjectTasks = useDataQueryStore((state) => state.invalidateProjectTasks)
  const updateProjectTask = useDataQueryStore((state) => state.updateProjectTask)
  const { tasksByStatus, defaultTopicId, isLoading } = useKanbanData(selectedProjectId)

  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null)
  const [localBoard, setLocalBoard] = useState<LocalBoard | null>(null)
  const localTasksByStatusRef = useRef<TasksByStatus | null>(null)
  const pendingStatusChangeRef = useRef<{ taskId: string; status: TaskStatus } | null>(null)

  const displayed =
    localBoard?.projectId === selectedProjectId ? localBoard.tasksByStatus : tasksByStatus

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ポインタが列に入った瞬間を優先し、なければ矩形交差、最後に角距離で判定
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args)
    if (pointer.length > 0) return pointer
    const rect = rectIntersection(args)
    if (rect.length > 0) return rect
    return closestCorners(args)
  }, [])

  const clearDragState = useCallback(() => {
    setDraggingTask(null)
    setOverColumnId(null)
    setLocalBoard(null)
    localTasksByStatusRef.current = null
    pendingStatusChangeRef.current = null
  }, [])

  useEffect(() => {
    return useUIStore.subscribe((state, previousState) => {
      if (state.selectedProjectId !== previousState.selectedProjectId) clearDragState()
    })
  }, [clearDragState])

  useEffect(() => {
    const pending = pendingStatusChangeRef.current
    if (!pending || findColumnOfTask(pending.taskId, tasksByStatus) !== pending.status) return
    localTasksByStatusRef.current = null
    pendingStatusChangeRef.current = null
    setLocalBoard(null)
  }, [tasksByStatus])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isAuthenticated) return
      const task = event.active.data.current?.task as Task | undefined
      if (task) setDraggingTask(task)
      // localTasksByStatus の初期化は handleDragOver の初回に lazy で行う
    },
    [isAuthenticated]
  ) // tasksByStatus 非依存: 初回 handleDragOver の prev ?? tasksByStatus で取得

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!isAuthenticated) return
      const { active, over } = event
      if (!over) {
        setOverColumnId(null)
        return
      }

      const activeId = active.id as string
      const base = localTasksByStatusRef.current ?? tasksByStatus
      const targetCol = resolveTargetColumn(over.id as string, base)

      if (!targetCol) {
        setOverColumnId(null)
        return
      }

      setOverColumnId(targetCol)

      // ドラッグ中タスクの現在列をローカル状態から動的に解決（Issue #2 修正）
      const currentCol = findColumnOfTask(activeId, base)
      if (!currentCol || currentCol === targetCol) return

      // WIP制限チェック: ターゲット列の現在カード数で判断
      const wipLimit = WIP_LIMITS[targetCol]
      if (wipLimit > 0 && base[targetCol].length >= wipLimit) return

      const activeTask = base[currentCol].find((t) => t.id === activeId)
      if (!activeTask) return

      const next = {
        ...base,
        [currentCol]: base[currentCol].filter((t) => t.id !== activeId),
        [targetCol]: sortKanbanColumnTasks(targetCol, [
          ...base[targetCol],
          { ...activeTask, status: targetCol, statusChangedAt: new Date() },
        ]),
      }
      localTasksByStatusRef.current = next
      if (selectedProjectId) setLocalBoard({ projectId: selectedProjectId, tasksByStatus: next })
    },
    [tasksByStatus, isAuthenticated, selectedProjectId]
  )

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      clearDragState()
    },
    [clearDragState]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!isAuthenticated) return
      const { active, over } = event
      const currentLocal = localTasksByStatusRef.current

      // ドロップ操作自体は完了しているため、保存待ちの間も枠とオーバーレイを残さない
      setDraggingTask(null)
      setOverColumnId(null)

      if (!over) {
        clearDragState()
        return
      }

      const activeTask = active.data.current?.task as Task | undefined
      if (!activeTask) {
        clearDragState()
        return
      }

      const base = currentLocal ?? tasksByStatus
      const targetCol = resolveTargetColumn(over.id as string, base)
      const originalCol = findColumnOfTask(activeTask.id, tasksByStatus)
      if (!targetCol || targetCol === originalCol) {
        clearDragState()
        return
      }

      const wipLimit = WIP_LIMITS[targetCol]
      if (wipLimit > 0 && tasksByStatus[targetCol].length >= wipLimit) {
        clearDragState()
        return
      }

      try {
        const updatedTask = unwrapResult(
          await taskRepo.update(activeTask.id, { status: targetCol })
        )
        // authoritative data が追いつくまではローカル順を残し、元列へのsnap backを防ぐ。
        pendingStatusChangeRef.current = { taskId: activeTask.id, status: targetCol }
        if (selectedProjectId) {
          updateProjectTask(selectedProjectId, updatedTask)
          invalidateProjectTasks(selectedProjectId)
        }
      } catch (err) {
        console.error('カンバンのステータス更新に失敗しました', err)
        clearDragState()
      }
    },
    [
      tasksByStatus,
      isAuthenticated,
      selectedProjectId,
      updateProjectTask,
      invalidateProjectTasks,
      clearDragState,
    ]
  )

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  if (isLoading) {
    return <KanbanSkeleton />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full gap-3 overflow-x-auto bg-background p-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={displayed[status]}
            isOver={overColumnId === status}
            defaultTopicId={defaultTopicId}
            canEdit={isAuthenticated}
          />
        ))}
      </div>

      {/* DragOverlay: useSortable を持たない KanbanCardContent を直接使用（Issue #6 修正）*/}
      <DragOverlay>
        {draggingTask && (
          <KanbanCardContent
            task={draggingTask}
            className="rotate-2 cursor-grabbing shadow-lg opacity-95"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
