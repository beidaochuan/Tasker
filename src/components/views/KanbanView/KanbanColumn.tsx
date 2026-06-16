import { memo, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { KanbanCard } from './KanbanCard'
import { WIP_LIMITS, COLUMN_LABELS, COLUMN_COLORS } from './kanbanConstants'
import { useUIStore } from '@/store/uiStore'
import type { Task, TaskStatus } from '@/types'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  isOver: boolean
  defaultTopicId: string | null
  canEdit: boolean
}

export const KanbanColumn = memo(function KanbanColumn({
  status,
  tasks,
  isOver,
  defaultTopicId,
  canEdit,
}: KanbanColumnProps) {
  const { openNewTaskDrawer } = useUIStore()
  // setNodeRef を列全体に設定してヘッダー部分もドロップゾーンに含める
  const { setNodeRef } = useDroppable({ id: status })

  const wipLimit = WIP_LIMITS[status]
  const isOverWip = wipLimit > 0 && tasks.length > wipLimit
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-72 flex-1 flex-col rounded-md border border-border bg-card',
        isOver && 'ring-2 ring-primary/60'
      )}
    >
      {/* ヘッダー */}
      <div
        className={cn(
          'flex items-center justify-between border-b border-border/70 px-3 py-2.5',
          isOverWip && 'bg-destructive/10'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', COLUMN_COLORS[status])}>
            {COLUMN_LABELS[status]}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isOverWip
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {tasks.length}
            {wipLimit > 0 && `/${wipLimit}`}
          </span>
        </div>
        {canEdit && status === 'todo' && defaultTopicId && (
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            title="タスクを追加"
            onClick={() => openNewTaskDrawer(defaultTopicId)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* カードリスト */}
      <div className={cn('flex-1 space-y-2 overflow-y-auto p-3', tasks.length === 0 && 'min-h-28')}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} canEdit={canEdit} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center rounded-md border border-dashed border-border/80 py-8">
            <p className="text-xs text-muted-foreground/70">
              {canEdit ? 'ここにドロップ' : 'タスクなし'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})
