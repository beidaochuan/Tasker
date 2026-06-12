import { useState } from 'react'
import { Check, Circle, ChevronRight, Clock, Trash2, AlertTriangle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue, isDueToday } from '@/utils/dateUtils'
import { useUIStore } from '@/store/uiStore'
import { taskRepo } from '@/repositories'
import { Button } from '@/components/ui/button'
import type { Task } from '@/types'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[hsl(var(--priority-low))]',
  medium: 'bg-[hsl(var(--priority-medium))]',
  high: 'bg-[hsl(var(--priority-high))]',
  urgent: 'bg-[hsl(var(--priority-urgent))]',
}

interface TaskRowProps {
  task: Task
}

export function TaskRow({ task }: TaskRowProps) {
  const { openTaskDrawer } = useUIStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isDone = task.status === 'done'

  async function toggleDone(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await taskRepo.update(task.id, { status: isDone ? 'todo' : 'done' })
    } catch (err) {
      console.error('ステータス更新に失敗しました', err)
    }
  }

  async function handleDelete() {
    await taskRepo.delete(task.id)
    setConfirmOpen(false)
  }

  const overdue = !isDone && isOverdue(task.dueDate)
  const today = !isDone && isDueToday(task.dueDate)

  return (
    <>
      <div
        className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/40"
        onClick={() => openTaskDrawer(task.id)}
      >
        <button
          onClick={toggleDone}
          className="shrink-0 text-muted-foreground hover:text-primary"
          title={isDone ? '未完了に戻す' : '完了にする'}
        >
          {isDone ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
        </button>

        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_COLORS[task.priority])}
          title={task.priority}
        />

        <span
          className={cn('flex-1 truncate text-sm', isDone && 'line-through text-muted-foreground')}
        >
          {task.title}
        </span>

        {task.dueDate && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-0.5 text-xs',
              overdue
                ? 'text-destructive'
                : today
                  ? 'text-[hsl(var(--priority-high))]'
                  : 'text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}

        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            setConfirmOpen(true)
          }}
          title="タスクを削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none">
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <Dialog.Title className="text-sm font-semibold">タスクの削除</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                  「{task.title}」を削除します。この操作は元に戻せません。
                </Dialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                キャンセル
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                削除
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
