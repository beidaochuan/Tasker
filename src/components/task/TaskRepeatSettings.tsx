import { useMemo } from 'react'
import { Controller, useWatch, type Control, type UseFormRegister } from 'react-hook-form'
import { RefreshCw } from 'lucide-react'
import type { TaskFormValues } from '@/components/task/taskFormModel'
import { FIELD_CLASS } from '@/components/task/taskFieldStyles'
import { buildRRule, describeRRule } from '@/utils/recurrenceUtils'

interface TaskRepeatSettingsProps {
  register: UseFormRegister<TaskFormValues>
  control: Control<TaskFormValues>
  isAuthenticated: boolean
}

const FREQ_OPTIONS = [
  { value: 'DAILY', label: '毎日' },
  { value: 'WEEKLY', label: '毎週' },
  { value: 'MONTHLY', label: '毎月' },
  { value: 'YEARLY', label: '毎年' },
] as const

export function TaskRepeatSettings({
  register,
  control,
  isAuthenticated,
}: TaskRepeatSettingsProps) {
  const repeatEnabled = useWatch({ control, name: 'repeatEnabled' })
  const repeatFreq = useWatch({ control, name: 'repeatFreq' })
  const repeatInterval = useWatch({ control, name: 'repeatInterval' })

  const repeatSummary = useMemo(() => {
    if (!repeatEnabled || !repeatFreq) return ''
    return describeRRule(buildRRule({ freq: repeatFreq, interval: repeatInterval }))
  }, [repeatEnabled, repeatFreq, repeatInterval])

  return (
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
        <label htmlFor="repeat-enabled" className="flex items-center gap-1.5 text-sm font-semibold">
          <RefreshCw className="h-3.5 w-3.5" />
          繰り返す
        </label>
        {repeatSummary && (
          <span className="ml-auto text-xs text-muted-foreground">{repeatSummary}</span>
        )}
      </div>

      {repeatEnabled && (
        <div className="grid grid-cols-[1fr_auto_72px_auto] items-center gap-2 pt-1">
          <select {...register('repeatFreq')} className={FIELD_CLASS} disabled={!isAuthenticated}>
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
  )
}
