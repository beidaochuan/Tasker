import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/uiStore'
import { projectRepo } from '@/repositories'

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
  const { isProjectFormOpen, closeProjectForm } = useUIStore()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', color: PROJECT_COLORS[0] },
  })

  const selectedColor = watch('color')

  async function onSubmit(values: FormValues) {
    try {
      await projectRepo.create({
        name: values.name,
        description: values.description,
        color: values.color,
        status: 'active',
        isArchived: false,
      })
      reset()
      closeProjectForm()
    } catch (err) {
      console.error('プロジェクトの作成に失敗しました', err)
    }
  }

  if (!isProjectFormOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={closeProjectForm} />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">プロジェクトを作成</h2>
          <Button variant="ghost" size="icon" onClick={closeProjectForm}>
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
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
            作成する
          </Button>
        </form>
      </div>
    </div>
  )
}
