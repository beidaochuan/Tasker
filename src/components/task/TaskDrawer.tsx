import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/uiStore'
import { useTask } from '@/hooks/useTasks'
import { useRecurrence } from '@/hooks/useRecurrence'
import { taskRepo } from '@/repositories'
import { buildRRule, parseRRule, describeRRule } from '@/utils/recurrenceUtils'

const FREQ_OPTIONS = [
  { value: 'DAILY', label: '毎日' },
  { value: 'WEEKLY', label: '毎週' },
  { value: 'MONTHLY', label: '毎月' },
  { value: 'YEARLY', label: '毎年' },
] as const

const taskSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled'] as const),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  startDate: z.string(),
  dueDate: z.string(),
  repeatEnabled: z.boolean(),
  repeatFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const),
  repeatInterval: z.coerce.number().int().min(1).max(99),
})

type TaskFormValues = z.infer<typeof taskSchema>

function repeatRuleFromValues(values: TaskFormValues): string | null {
  if (!values.repeatEnabled) return null
  return buildRRule({ freq: values.repeatFreq, interval: values.repeatInterval })
}

export function TaskDrawer() {
  const { isTaskDrawerOpen, selectedTaskId, newTaskTopicId, closeTaskDrawer } = useUIStore()
  const { completeRecurringTask } = useRecurrence()

  const isNew = newTaskTopicId !== null
  const existingTask = useTask(isNew ? null : selectedTaskId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      startDate: '',
      dueDate: '',
      repeatEnabled: false,
      repeatFreq: 'DAILY',
      repeatInterval: 1,
    },
  })

  const repeatEnabled = watch('repeatEnabled')
  const repeatFreq = watch('repeatFreq')
  const repeatInterval = watch('repeatInterval')

  // #6: isTaskDrawerOpen を依存配列に含め、開くたびに確実に reset する
  useEffect(() => {
    if (!isTaskDrawerOpen) return
    if (existingTask) {
      const parsed = parseRRule(existingTask.repeatRule)
      reset({
        title: existingTask.title,
        description: existingTask.description,
        status: existingTask.status,
        priority: existingTask.priority,
        startDate: existingTask.startDate ? existingTask.startDate.toISOString().split('T')[0] : '',
        dueDate: existingTask.dueDate ? existingTask.dueDate.toISOString().split('T')[0] : '',
        repeatEnabled: parsed !== null,
        repeatFreq: parsed?.freq ?? 'DAILY',
        repeatInterval: parsed?.interval ?? 1,
      })
    } else if (isNew) {
      reset({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        startDate: '',
        dueDate: '',
        repeatEnabled: false,
        repeatFreq: 'DAILY',
        repeatInterval: 1,
      })
    }
  }, [existingTask, isNew, reset, isTaskDrawerOpen])

  async function onSubmit(values: TaskFormValues) {
    try {
      const startDate = values.startDate ? new Date(values.startDate) : null
      const dueDate = values.dueDate ? new Date(values.dueDate) : null
      // #7: existingTask.repeatRule（DB値）ではなくフォームの現在値で判定
      const repeatRule = repeatRuleFromValues(values)

      if (isNew && newTaskTopicId) {
        const existing = await taskRepo.getByTopicId(newTaskTopicId)
        const order = existing.ok ? existing.data.length : 0
        await taskRepo.create({
          topicId: newTaskTopicId,
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          startDate,
          dueDate,
          order,
          tags: [],
          repeatRule,
        })
      } else if (existingTask) {
        if (values.status === 'done' && existingTask.status !== 'done' && repeatRule) {
          await completeRecurringTask({
            ...existingTask,
            title: values.title,
            description: values.description,
            priority: values.priority,
            startDate,
            dueDate,
            repeatRule,
          })
          closeTaskDrawer()
          return
        }
        await taskRepo.update(existingTask.id, {
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          startDate,
          dueDate,
          repeatRule,
        })
      }

      closeTaskDrawer()
    } catch (err) {
      console.error('タスクの保存に失敗しました', err)
      // #4: エラー時もドロワーを閉じる（保存失敗はコンソールで確認可能）
      closeTaskDrawer()
    }
  }

  async function handleDelete() {
    if (!existingTask) return
    try {
      await taskRepo.delete(existingTask.id)
      closeTaskDrawer()
    } catch (err) {
      console.error('タスクの削除に失敗しました', err)
      closeTaskDrawer()
    }
  }

  // #5: useMemo で依存値が変わったときだけ再計算
  const repeatSummary = useMemo(() => {
    if (!repeatEnabled || !repeatFreq) return ''
    return describeRRule(buildRRule({ freq: repeatFreq, interval: repeatInterval }))
  }, [repeatEnabled, repeatFreq, repeatInterval])

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-startdate" className="text-sm font-medium">
                開始日
              </label>
              <input
                id="task-startdate"
                {...register('startDate')}
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
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
          </div>

          {/* 繰り返し設定 */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Controller
                name="repeatEnabled"
                control={control}
                render={({ field }) => (
                  <input
                    id="repeat-enabled"
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                )}
              />
              <label
                htmlFor="repeat-enabled"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                繰り返す
              </label>
              {repeatSummary && (
                <span className="ml-auto text-xs text-muted-foreground">{repeatSummary}</span>
              )}
            </div>

            {repeatEnabled && (
              <div className="flex items-center gap-2 pt-1">
                <select
                  {...register('repeatFreq')}
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {FREQ_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground whitespace-nowrap">ごとに</span>
                <input
                  {...register('repeatInterval')}
                  type="number"
                  min={1}
                  max={99}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">回</span>
              </div>
            )}
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
