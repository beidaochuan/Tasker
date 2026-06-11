import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/uiStore'
import { useTask } from '@/hooks/useTasks'
import { taskRepo } from '@/repositories'

const taskSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled'] as const),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  dueDate: z.string(),
})

type TaskFormValues = z.infer<typeof taskSchema>

export function TaskDrawer() {
  const { isTaskDrawerOpen, selectedTaskId, newTaskTopicId, closeTaskDrawer } = useUIStore()

  const isNew = newTaskTopicId !== null
  const existingTask = useTask(isNew ? null : selectedTaskId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '' },
  })

  useEffect(() => {
    if (existingTask) {
      reset({
        title: existingTask.title,
        description: existingTask.description,
        status: existingTask.status,
        priority: existingTask.priority,
        dueDate: existingTask.dueDate ? existingTask.dueDate.toISOString().split('T')[0] : '',
      })
    } else if (isNew) {
      reset({ title: '', description: '', status: 'todo', priority: 'medium', dueDate: '' })
    }
  }, [existingTask, isNew, reset])

  async function onSubmit(values: TaskFormValues) {
    try {
      const dueDate = values.dueDate ? new Date(values.dueDate) : null

      if (isNew && newTaskTopicId) {
        const existing = await taskRepo.getByTopicId(newTaskTopicId)
        const order = existing.ok ? existing.data.length : 0
        await taskRepo.create({
          topicId: newTaskTopicId,
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate,
          startDate: null,
          order,
          tags: [],
          repeatRule: null,
        })
      } else if (existingTask) {
        await taskRepo.update(existingTask.id, {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          dueDate,
        })
      }

      closeTaskDrawer()
    } catch (err) {
      console.error('タスクの保存に失敗しました', err)
    }
  }

  async function handleDelete() {
    if (!existingTask) return
    try {
      await taskRepo.delete(existingTask.id)
      closeTaskDrawer()
    } catch (err) {
      console.error('タスクの削除に失敗しました', err)
    }
  }

  if (!isTaskDrawerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={closeTaskDrawer} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">{isNew ? 'タスクを作成' : 'タスクを編集'}</h2>
          <div className="flex gap-1">
            {!isNew && (
              <Button variant="ghost" size="icon" onClick={handleDelete} title="削除">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={closeTaskDrawer}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="text-sm font-medium">
              タイトル
            </label>
            <input
              id="task-title"
              {...register('title')}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="タスク名を入力"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-description" className="text-sm font-medium">
              説明
            </label>
            <textarea
              id="task-description"
              {...register('description')}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="説明（省略可）"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-status" className="text-sm font-medium">
                ステータス
              </label>
              <select
                id="task-status"
                {...register('status')}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todo">未着手</option>
                <option value="in_progress">進行中</option>
                <option value="done">完了</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-priority" className="text-sm font-medium">
                優先度
              </label>
              <select
                id="task-priority"
                {...register('priority')}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-duedate" className="text-sm font-medium">
              期日
            </label>
            <input
              id="task-duedate"
              {...register('dueDate')}
              type="date"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="mt-auto pt-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isNew ? '作成する' : '保存する'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
