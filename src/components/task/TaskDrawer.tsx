import { useCallback, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskComments } from '@/components/task/TaskComments'
import { TaskWorkList } from '@/components/task/TaskWorkList'
import { TaskFormFields } from '@/components/task/TaskFormFields'
import { TaskRepeatSettings } from '@/components/task/TaskRepeatSettings'
import { TaskRelatedTasks } from '@/components/task/TaskRelatedTasks'
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
import { parseDateInput } from '@/utils/dateUtils'
import { unwrapResult } from '@/utils/resultUtils'

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

  function handleProjectChange(projectId: string) {
    setAutoSelectTopicProjectId(projectId)
    setValue('topicId', '', { shouldDirty: true, shouldValidate: true })
  }

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
            category: values.category,
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
              category: values.category,
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
            category: values.category,
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
          <div className="flex items-baseline gap-2">
            <h2 id="task-dialog-title" className="text-base font-semibold">
              {!isAuthenticated ? 'タスク詳細' : isNew ? 'タスクを作成' : 'タスクを編集'}
            </h2>
            <span className="text-xs text-muted-foreground" data-testid="task-id">
              ID: {isNew ? '未採番' : selectedTaskId}
            </span>
          </div>
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
            <TaskFormFields
              register={register}
              control={control}
              errors={errors}
              isAuthenticated={isAuthenticated}
              projects={projects}
              projectTopics={projectTopics}
              onProjectChange={handleProjectChange}
            />

            <TaskWorkList taskId={isNew ? null : selectedTaskId} canEdit={isAuthenticated} />

            <TaskComments taskId={isNew ? null : selectedTaskId} canEdit={isAuthenticated} />

            {!isNew && (
              <TaskRelatedTasks
                taskId={selectedTaskId}
                canEdit={isAuthenticated}
                projectTopics={projectTopics}
                onError={setSubmitError}
              />
            )}

            <TaskRepeatSettings
              register={register}
              control={control}
              isAuthenticated={isAuthenticated}
            />
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
