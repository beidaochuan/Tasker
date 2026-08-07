import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import type { TaskFormValues } from '@/components/task/taskFormModel'
import { FIELD_CLASS, LABEL_CLASS, TEXTAREA_CLASS } from '@/components/task/taskFieldStyles'
import { CATEGORY_LABELS } from '@/utils/taskPresentation'
import type { Project, TaskCategory, Topic } from '@/types'

interface TaskFormFieldsProps {
  register: UseFormRegister<TaskFormValues>
  control: Control<TaskFormValues>
  errors: FieldErrors<TaskFormValues>
  isAuthenticated: boolean
  projects: Project[]
  projectTopics: Topic[] | undefined
  onProjectChange: (projectId: string) => void
}

export function TaskFormFields({
  register,
  control,
  errors,
  isAuthenticated,
  projects,
  projectTopics,
  onProjectChange,
}: TaskFormFieldsProps) {
  return (
    <>
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
                  onProjectChange(event.target.value)
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
          {errors.projectId && <p className="text-xs text-danger">{errors.projectId.message}</p>}
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
                  !isAuthenticated || projectTopics === undefined || projectTopics.length === 0
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

      <div className="grid grid-cols-3 gap-4">
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
            <option value="paused">一時停止</option>
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

        <div className="space-y-1.5">
          <label htmlFor="task-category" className={LABEL_CLASS}>
            区分
          </label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <select
                id="task-category"
                value={field.value ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  field.onChange(value === '' ? null : (value as TaskCategory))
                }}
                className={FIELD_CLASS}
                disabled={!isAuthenticated}
              >
                <option value="">未設定</option>
                <option value="software">{CATEGORY_LABELS.software}</option>
                <option value="electric">{CATEGORY_LABELS.electric}</option>
              </select>
            )}
          />
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
          {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
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
    </>
  )
}
