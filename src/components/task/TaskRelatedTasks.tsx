import { useEffect, useMemo, useState } from 'react'
import { Link2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FIELD_CLASS } from '@/components/task/taskFieldStyles'
import { useUIStore } from '@/store/uiStore'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { taskRepo, topicRepo } from '@/repositories'
import { unwrapResult } from '@/utils/resultUtils'
import type { Project, Task, Topic } from '@/types'

interface TaskRelatedTasksProps {
  taskId: string | null
  canEdit: boolean
  projectTopics: Topic[] | undefined
  projects: Project[]
  onError: (message: string | null) => void
}

export function TaskRelatedTasks({
  taskId,
  canEdit,
  projectTopics,
  projects,
  onError,
}: TaskRelatedTasksProps) {
  const { setSelectedProjectId, openTaskDrawer } = useUIStore()
  const invalidateAllProjects = useDataQueryStore((state) => state.invalidateAllProjects)

  const [relatedTasks, setRelatedTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [relatedTaskIdToAdd, setRelatedTaskIdToAdd] = useState('')
  const [isSavingRelations, setIsSavingRelations] = useState(false)

  useEffect(() => {
    if (!taskId) return

    let cancelled = false

    // タスク切り替え時に前のタスクの関連タスクが一瞬表示されないよう、先に空にする。
    Promise.resolve().then(() => {
      if (cancelled) return
      setRelatedTasks([])
      setAllTasks([])
      setRelatedTaskIdToAdd('')
    })

    void Promise.all([taskRepo.getRelatedTasks(taskId), taskRepo.getAll()])
      .then(([relatedResult, allTasksResult]) => {
        if (cancelled) return
        if (relatedResult.ok) setRelatedTasks(relatedResult.data)
        else onError(relatedResult.error.message)
        if (allTasksResult.ok) setAllTasks(allTasksResult.data)
        else onError(allTasksResult.error.message)
      })
      .catch(() => {
        if (!cancelled) onError('関連タスクの読み込みに失敗しました')
      })

    return () => {
      cancelled = true
    }
  }, [taskId, onError])

  async function handleOpenRelatedTask(task: Task) {
    onError(null)
    try {
      const currentProjectTopic = projectTopics?.find((topic) => topic.id === task.topicId)
      const projectId =
        currentProjectTopic?.projectId ??
        unwrapResult(await topicRepo.getById(task.topicId)).projectId
      setSelectedProjectId(projectId)
      openTaskDrawer(task.id)
    } catch (err) {
      console.error('関連タスクを開けませんでした', err)
      onError(err instanceof Error ? err.message : '関連タスクを開けませんでした')
    }
  }

  async function saveRelatedTasks(nextRelatedTaskIds: string[]) {
    if (!taskId || !canEdit) return
    onError(null)
    setIsSavingRelations(true)
    try {
      const result = unwrapResult(await taskRepo.replaceRelatedTasks(taskId, nextRelatedTaskIds))
      setRelatedTasks(result)
      setRelatedTaskIdToAdd('')
      invalidateAllProjects()
    } catch (err) {
      console.error('関連タスクの保存に失敗しました', err)
      onError(err instanceof Error ? err.message : '関連タスクの保存に失敗しました')
    } finally {
      setIsSavingRelations(false)
    }
  }

  function handleAddRelatedTask() {
    if (!relatedTaskIdToAdd || relatedTasks.some((task) => task.id === relatedTaskIdToAdd)) return
    void saveRelatedTasks([...relatedTasks.map((task) => task.id), relatedTaskIdToAdd])
  }

  function handleRemoveRelatedTask(taskIdToRemove: string) {
    void saveRelatedTasks(
      relatedTasks.filter((task) => task.id !== taskIdToRemove).map((task) => task.id)
    )
  }

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )
  const topicProjectIds = useMemo(
    () => new Map(projectTopics?.map((topic) => [topic.id, topic.projectId]) ?? []),
    [projectTopics]
  )
  const availableRelatedTasks = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.id !== taskId && !relatedTasks.some((relatedTask) => relatedTask.id === task.id)
      ),
    [allTasks, taskId, relatedTasks]
  )

  if (!taskId) return null

  return (
    <section
      className="space-y-3 rounded-md border border-border bg-background p-3"
      aria-labelledby="related-tasks-heading"
    >
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5" />
        <h3 id="related-tasks-heading" className="text-sm font-semibold">
          関連タスク
        </h3>
      </div>

      {relatedTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">関連タスクはありません</p>
      ) : (
        <ul className="space-y-1.5">
          {relatedTasks.map((task) => (
            <li
              key={task.id}
              className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
            >
              <button
                type="button"
                onClick={() => void handleOpenRelatedTask(task)}
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline focus:outline-none focus:underline"
                aria-label={`「${task.title}」を開く`}
              >
                {task.title}
              </button>
              {topicProjectIds.has(task.topicId) && (
                <span className="text-xs text-muted-foreground">このプロジェクト</span>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemoveRelatedTask(task.id)}
                  disabled={isSavingRelations}
                  aria-label={`「${task.title}」との関連を解除`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <select
            aria-label="関連タスクを追加"
            value={relatedTaskIdToAdd}
            onChange={(event) => setRelatedTaskIdToAdd(event.target.value)}
            className={FIELD_CLASS}
            disabled={isSavingRelations || availableRelatedTasks.length === 0}
          >
            <option value="">
              {availableRelatedTasks.length === 0 ? '追加できるタスクはありません' : 'タスクを選択'}
            </option>
            {availableRelatedTasks.map((task) => {
              const projectName = projectNames.get(topicProjectIds.get(task.topicId) ?? '')
              return (
                <option key={task.id} value={task.id}>
                  {projectName ? `${task.title}（${projectName}）` : task.title}
                </option>
              )
            })}
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddRelatedTask}
            disabled={!relatedTaskIdToAdd || isSavingRelations}
            aria-label="関連タスクを追加する"
          >
            <Plus className="mr-1 h-4 w-4" />
            追加
          </Button>
        </div>
      )}
    </section>
  )
}
