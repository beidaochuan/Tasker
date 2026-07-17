import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskWorkList } from '@/components/task/TaskWorkList'
import {
  createEmptyTaskFormValues,
  createExistingTaskFormValues,
  createNewTaskFormValues,
  repeatRuleFromFormValues,
  taskFormSchema,
  type TaskFormValues,
} from '@/components/task/taskFormModel'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useTask, useTopics } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useRecurrence } from '@/hooks/useRecurrence'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { taskRepo } from '@/repositories'
import { buildRRule, describeRRule } from '@/utils/recurrenceUtils'
import { parseDateInput } from '@/utils/dateUtils'
import { unwrapResult } from '@/utils/resultUtils'

const FREQ_OPTIONS = [
  { value: 'DAILY', label: '毎日' },
  { value: 'WEEKLY', label: '毎週' },
  { value: 'MONTHLY', label: '毎月' },
  { value: 'YEARLY', label: '毎年' },
] as const

const FIELD_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20'

const TEXTAREA_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20'

const LABEL_CLASS = 'text-xs font-semibold text-muted-foreground'

export function TaskDrawer() {
  const { isTaskDrawerOpen, selectedProjectId, selectedTaskId, newTaskTopicId, closeTaskDrawer } =
    useUIStore()
  const { isAuthenticated, openLoginDialog } = useAuthStore()
  const { completeRecurringTask } = useRecurrence()
  const invalidateProjectTasks = useDataQueryStore((state) => state.invalidateProjectTasks)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [autoSelectTopicProjectId, setAutoSelectTopicProjectId] = useState<string | null>(null)

  const isNew = newTaskTopicId !== null
  const existingTask = useTask(
    isTaskDrawerOpen && !isNew ? selectedTaskId : null,
    isTaskDrawerOpen ? selectedProjectId : null
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: createEmptyTaskFormValues(),
  })

  const repeatEnabled = useWatch({ control, name: 'repeatEnabled' })
  const repeatFreq = useWatch({ control, name: 'repeatFreq' })
  const repeatInterval = useWatch({ control, name: 'repeatInterval' })
  const selectedFormProjectId = useWatch({ control, name: 'projectId' })
  const selectedFormTopicId = useWatch({ control, name: 'topicId' })

  const projects = useProjects()
  const projectTopics = useTopics(
    isTaskDrawerOpen && selectedFormProjectId ? selectedFormProjectId : null
  )

  const handleClose = useCallback(() => {
    setSubmitError(null)
    closeTaskDrawer()
  }, [closeTaskDrawer])

  useEffect(() => {
    if (!isTaskDrawerOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      event.preventDefault()
      handleClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isTaskDrawerOpen])

  // 同じタスクを開き直した場合も、保存済みの値からフォームを作り直す。
  useEffect(() => {
    if (!isTaskDrawerOpen) return
    if (existingTask && existingTask.id === selectedTaskId) {
      reset(createExistingTaskFormValues(existingTask, selectedProjectId))
    } else if (isNew) {
      reset(createNewTaskFormValues(selectedProjectId, newTaskTopicId))
    }
  }, [
    existingTask,
    isNew,
    reset,
    isTaskDrawerOpen,
    selectedProjectId,
    selectedTaskId,
    newTaskTopicId,
  ])

  useEffect(() => {
    if (!isTaskDrawerOpen || projectTopics === undefined) return
    if (autoSelectTopicProjectId !== selectedFormProjectId) return
    if (projectTopics.some((topic) => topic.id === selectedFormTopicId)) return
    const nextTopicId = projectTopics[0]?.id ?? ''
    if (nextTopicId === selectedFormTopicId) return
    setValue('topicId', nextTopicId, { shouldDirty: true, shouldValidate: true })
  }, [
    autoSelectTopicProjectId,
    isTaskDrawerOpen,
    projectTopics,
    selectedFormProjectId,
    selectedFormTopicId,
    setValue,
  ])

  const hasSelectedFormTopic =
    projectTopics?.some((topic) => topic.id === selectedFormTopicId) ?? false

  async function onSubmit(values: TaskFormValues) {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    setSubmitError(null)
    try {
      const startDate = parseDateInput(values.startDate)
      const dueDate = parseDateInput(values.dueDate)
      // 保存前のフォーム値を、通常更新と繰り返し完了の両方で共通利用する。
      const repeatRule = repeatRuleFromFormValues(values)

      if (isNew) {
        const existing = unwrapResult(await taskRepo.getByTopicId(values.topicId))
        const order = existing.length
        unwrapResult(
          await taskRepo.create({
            topicId: values.topicId,
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
        )
      } else if (existingTask) {
        if (values.status === 'done' && existingTask.status !== 'done' && repeatRule) {
          await completeRecurringTask(
            {
              ...existingTask,
              topicId: values.topicId,
              title: values.title,
              description: values.description,
              priority: values.priority,
              startDate,
              dueDate,
              repeatRule,
            },
            [selectedProjectId, values.projectId].filter((id): id is string => Boolean(id))
          )
          handleClose()
          return
        }
        unwrapResult(
          await taskRepo.update(existingTask.id, {
            topicId: values.topicId,
            title: values.title,
            description: values.description,
            status: values.status,
            priority: values.priority,
            startDate,
            dueDate,
            repeatRule,
          })
        )
      }

      const affectedProjectIds = isNew
        ? [values.projectId]
        : [selectedProjectId, values.projectId].filter((id): id is string => Boolean(id))
      for (const projectId of new Set(affectedProjectIds)) invalidateProjectTasks(projectId)
      handleClose()
    } catch (err) {
      console.error('タスクの保存に失敗しました', err)
      setSubmitError(err instanceof Error ? err.message : 'タスクの保存に失敗しました')
    }
  }

  async function handleDelete() {
    if (!isAuthenticated) {
      openLoginDialog()
      return
    }
    if (!existingTask) return
    try {
      unwrapResult(await taskRepo.delete(existingTask.id))
      if (selectedProjectId) invalidateProjectTasks(selectedProjectId)
      handleClose()
    } catch (err) {
      console.error('タスクの削除に失敗しました', err)
      setSubmitError(err instanceof Error ? err.message : 'タスクの削除に失敗しました')
    }
  }

  const repeatSummary = useMemo(() => {
    if (!repeatEnabled || !repeatFreq) return ''
    return describeRRule(buildRRule({ freq: repeatFreq, interval: repeatInterval }))
  }, [repeatEnabled, repeatFreq, repeatInterval])

  if (!isTaskDrawerOpen) return null
  if (isNew && !isAuthenticated) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="task-dialog-title" className="text-base font-semibold">
            {!isAuthenticated ? 'タスク詳細' : isNew ? 'タスクを作成' : 'タスクを編集'}
          </h2>
          <div className="flex gap-1">
            {isAuthenticated && !isNew && (
              <Button variant="ghost" size="icon" onClick={handleDelete} title="削除">
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <label htmlFor="task-title" className={LABEL_CLASS}>
                タイトル
              </label>
              <input
                id="task-title"
                {...register('title')}
                className={FIELD_CLASS}
                placeholder="タスク名を入力"
                disabled={!isAuthenticated}
              />
              {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="task-project" className={LABEL_CLASS}>
                  プロジェクト
                </label>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="task-project"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        setAutoSelectTopicProjectId(event.target.value)
                        setValue('topicId', '', {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }}
                      className={FIELD_CLASS}
                      disabled={!isAuthenticated}
                    >
                      <option value="">プロジェクトを選択</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.projectId && (
                  <p className="text-xs text-danger">{errors.projectId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="task-topic" className={LABEL_CLASS}>
                  トピック
                </label>
                <Controller
                  name="topicId"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="task-topic"
                      {...field}
                      className={FIELD_CLASS}
                      disabled={
                        !isAuthenticated ||
                        projectTopics === undefined ||
                        projectTopics.length === 0
                      }
                    >
                      {projectTopics === undefined ? (
                        <option value="">読み込み中</option>
                      ) : projectTopics.length === 0 ? (
                        <option value="">トピックがありません</option>
                      ) : (
                        projectTopics.map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                />
                {errors.topicId && <p className="text-xs text-danger">{errors.topicId.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-description" className={LABEL_CLASS}>
                説明
              </label>
              <textarea
                id="task-description"
                {...register('description')}
                rows={6}
                className={TEXTAREA_CLASS}
                placeholder="説明（省略可）"
                disabled={!isAuthenticated}
              />
            </div>

            <TaskWorkList taskId={isNew ? null : selectedTaskId} canEdit={isAuthenticated} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="task-status" className={LABEL_CLASS}>
                  ステータス
                </label>
                <select
                  id="task-status"
                  {...register('status')}
                  className={FIELD_CLASS}
                  disabled={!isAuthenticated}
                >
                  <option value="todo">未着手</option>
                  <option value="in_progress">進行中</option>
                  <option value="done">完了</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="task-priority" className={LABEL_CLASS}>
                  優先度
                </label>
                <select
                  id="task-priority"
                  {...register('priority')}
                  className={FIELD_CLASS}
                  disabled={!isAuthenticated}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="task-startdate" className={LABEL_CLASS}>
                  開始日
                </label>
                <input
                  id="task-startdate"
                  {...register('startDate')}
                  type="date"
                  className={FIELD_CLASS}
                  disabled={!isAuthenticated}
                />
                {errors.startDate && (
                  <p className="text-xs text-danger">{errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="task-duedate" className={LABEL_CLASS}>
                  期日
                </label>
                <input
                  id="task-duedate"
                  {...register('dueDate')}
                  type="date"
                  className={FIELD_CLASS}
                  disabled={!isAuthenticated}
                />
                {errors.dueDate && <p className="text-xs text-danger">{errors.dueDate.message}</p>}
              </div>
            </div>

            {/* 繰り返し設定 */}
            <div className="space-y-3 rounded-md border border-border bg-background p-3">
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
                      disabled={!isAuthenticated}
                    />
                  )}
                />
                <label
                  htmlFor="repeat-enabled"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  繰り返す
                </label>
                {repeatSummary && (
                  <span className="ml-auto text-xs text-muted-foreground">{repeatSummary}</span>
                )}
              </div>

              {repeatEnabled && (
                <div className="grid grid-cols-[1fr_auto_72px_auto] items-center gap-2 pt-1">
                  <select
                    {...register('repeatFreq')}
                    className={FIELD_CLASS}
                    disabled={!isAuthenticated}
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
                    className={FIELD_CLASS}
                    disabled={!isAuthenticated}
                  />
                  <span className="text-sm text-muted-foreground">回</span>
                </div>
              )}
            </div>
          </div>

          {isAuthenticated && (
            <div className="border-t border-border bg-card p-5">
              {submitError && (
                <p role="alert" className="mb-3 text-xs text-danger">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !hasSelectedFormTopic}
              >
                {isNew ? '作成する' : '保存する'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
