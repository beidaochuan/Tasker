import { useState } from 'react'
import { Check, Circle, ChevronRight, Clock, Trash2, AlertTriangle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/utils/cn'
import { formatDate, isOverdue, isDueToday } from '@/utils/dateUtils'
import { useUIStore } from '@/store/uiStore'
import { useRecurrence } from '@/hooks/useRecurrence'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { taskRepo } from '@/repositories'
import { Button } from '@/components/ui/button'
import {
  PRIORITY_DOT_CLASSES,
  PRIORITY_LABELS,
  PRIORITY_TEXT_CLASSES,
} from '@/utils/taskPresentation'
import { hasRepeatRule } from '@/utils/recurrenceUtils'
import { unwrapResult } from '@/utils/resultUtils'
import type { Task } from '@/types'

interface TaskRowProps {
  task: Task
  canEdit?: boolean
}

export function TaskRow({ task, canEdit = true }: TaskRowProps) {
  const { openTaskDrawer } = useUIStore()
  const { completeRecurringTask } = useRecurrence()
  const refresh = useRefreshStore((s) => s.refresh)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isDone = task.status === 'done'

  async function toggleDone(e: React.MouseEvent) {
    e.stopPropagation()
    if (!canEdit) return
    try {
      if (isDone) {
        unwrapResult(await taskRepo.update(task.id, { status: 'todo' }))
      } else if (hasRepeatRule(task.repeatRule)) {
        await completeRecurringTask(task)
      } else {
        unwrapResult(await taskRepo.update(task.id, { status: 'done' }))
      }
      refresh()
    } catch (err) {
      console.error('ステータス更新に失敗しました', err)
    }
  }

  async function handleDelete() {
    if (!canEdit) return
    setDeleteError(null)
    try {
      unwrapResult(await taskRepo.delete(task.id))
      refresh()
      setConfirmOpen(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'タスクの削除に失敗しました')
    }
  }

  const overdue = !isDone && isOverdue(task.dueDate)
  const today = !isDone && isDueToday(task.dueDate)

  return (
    <>
      <div
        className={cn(
          'group flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-accent/60',
          isDone && 'text-muted-foreground'
        )}
        onClick={() => openTaskDrawer(task.id)}
      >
        {canEdit ? (
          <button
            onClick={toggleDone}
            className="shrink-0 text-muted-foreground hover:text-primary"
            title={isDone ? '未完了に戻す' : '完了にする'}
          >
            {isDone ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
          </button>
        ) : (
          <span className="shrink-0 text-muted-foreground">
            {isDone ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
          </span>
        )}

        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT_CLASSES[task.priority])}
          title={PRIORITY_LABELS[task.priority]}
        />

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            isDone && 'line-through decoration-foreground/40'
          )}
        >
          {task.title}
        </span>

        <span
          className={cn(
            'hidden shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium sm:inline-flex',
            PRIORITY_TEXT_CLASSES[task.priority]
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>

        {task.dueDate && (
          <span
            className={cn(
              'flex w-24 shrink-0 items-center justify-end gap-1 text-xs',
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

        {canEdit && (
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
        )}

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
              {deleteError && (
                <p role="alert" className="mr-auto self-center text-xs text-destructive">
                  {deleteError}
                </p>
              )}
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
