import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useProject } from '@/hooks/useProjects'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { projectRepo } from '@/repositories'
import { unwrapResult } from '@/utils/resultUtils'

const PROJECT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#64748b',
]

const schema = z.object({
  name: z.string().min(1, 'プロジェクト名は必須です'),
  description: z.string(),
  color: z.string(),
})

type FormValues = z.infer<typeof schema>

export function ProjectForm() {
  const { isProjectFormOpen, editingProjectId, closeProjectForm } = useUIStore()
  const { isAuthenticated, openLoginDialog } = useAuthStore()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const invalidateProjects = useDataQueryStore((state) => state.invalidateProjects)
  const editingProject = useProject(editingProjectId)
  const isEditing = editingProjectId !== null

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', color: PROJECT_COLORS[0] },
  })

  const initializedFormKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isProjectFormOpen) {
      initializedFormKeyRef.current = null
      return
    }

    if (isProjectFormOpen && !isAuthenticated) {
      closeProjectForm()
      openLoginDialog()
      return
    }

    const formKey = isEditing ? `edit:${editingProjectId}` : 'new'
    if (initializedFormKeyRef.current === formKey) return

    if (isEditing) {
      if (!editingProject || editingProject.id !== editingProjectId) return
      reset({
        name: editingProject.name,
        description: editingProject.description,
        color: editingProject.color,
      })
    } else {
      reset({ name: '', description: '', color: PROJECT_COLORS[0] })
    }

    initializedFormKeyRef.current = formKey
  }, [
    isProjectFormOpen,
    isAuthenticated,
    isEditing,
    editingProjectId,
    editingProject,
    reset,
    closeProjectForm,
    openLoginDialog,
  ])

  const selectedColor = useWatch({ control, name: 'color' })

  const handleClose = useCallback(() => {
    setSubmitError(null)
    closeProjectForm()
  }, [closeProjectForm])

  useEffect(() => {
    if (!isProjectFormOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      event.preventDefault()
      handleClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isProjectFormOpen])

  async function onSubmit(values: FormValues) {
    if (!isAuthenticated) {
      closeProjectForm()
      openLoginDialog()
      return
    }
    setSubmitError(null)
    try {
      if (isEditing) {
        unwrapResult(
          await projectRepo.update(editingProjectId!, {
            name: values.name,
            description: values.description,
            color: values.color,
          })
        )
      } else {
        unwrapResult(
          await projectRepo.create({
            name: values.name,
            description: values.description,
            color: values.color,
            status: 'active',
            isArchived: false,
          })
        )
      }
      invalidateProjects()
      reset()
      handleClose()
    } catch (err) {
      console.error('プロジェクトの保存に失敗しました', err)
      setSubmitError(err instanceof Error ? err.message : 'プロジェクトの保存に失敗しました')
    }
  }

  if (!isProjectFormOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            {isEditing ? 'プロジェクトを編集' : 'プロジェクトを作成'}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="text-sm font-medium">
              プロジェクト名
            </label>
            <input
              id="project-name"
              {...register('name')}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="プロジェクト名"
            />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-description" className="text-sm font-medium">
              説明（省略可）
            </label>
            <textarea
              id="project-description"
              {...register('description')}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">カラー</span>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isEditing ? '保存する' : '作成する'}
          </Button>
          {submitError && (
            <p role="alert" className="text-xs text-danger">
              {submitError}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
