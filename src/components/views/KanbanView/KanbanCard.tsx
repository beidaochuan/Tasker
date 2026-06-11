import { memo, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/utils/cn'
import { KanbanCardContent } from './KanbanCardContent'
import { useUIStore } from '@/store/uiStore'
import type { Task } from '@/types'

interface KanbanCardProps {
  task: Task
}

export const KanbanCard = memo(function KanbanCard({ task }: KanbanCardProps) {
  const { openTaskDrawer } = useUIStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card', task },
  })
  // isDragging が true → false に変わった直後の click イベントを無視するフラグ
  const wasDragging = useRef(false)

  useEffect(() => {
    if (isDragging) {
      wasDragging.current = true
    }
  }, [isDragging])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
      onClick={(e) => {
        if (wasDragging.current) {
          wasDragging.current = false
          return
        }
        e.stopPropagation()
        openTaskDrawer(task.id)
      }}
    >
      <KanbanCardContent task={task} />
    </div>
  )
})
