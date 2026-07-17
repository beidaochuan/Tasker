import { useCallback, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg, DateSelectArg, DatesSetArg } from '@fullcalendar/core'
import { FolderOpen } from 'lucide-react'
import { useCalendarTasks } from '@/hooks/useCalendarTasks'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { taskRepo } from '@/repositories'
import { useDataQueryStore } from '@/hooks/useDataQueries'
import { resolveTaskId } from '@/utils/recurrenceUtils'
import './calendar.css'

// Issue #7/#8: レンダリングと無関係な静的 props はモジュール定数に切り出して参照を安定させる
const FC_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]

const FC_HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
} as const

const FC_BUTTON_TEXT = {
  today: '今日',
  month: '月',
  week: '週',
  day: '日',
} as const

export function CalendarView() {
  // Hooks はすべて early return より前に呼ぶ（React の規則）
  const { selectedProjectId, openTaskDrawer } = useUIStore()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const invalidateProjectTasks = useDataQueryStore((state) => state.invalidateProjectTasks)
  const updateProjectTask = useDataQueryStore((state) => state.updateProjectTask)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const events = useCalendarTasks(selectedProjectId, rangeStart, rangeEnd)

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRangeStart(arg.start)
    setRangeEnd(arg.end)
  }, [])

  // Issue #5: useCallback で関数参照を安定させ FullCalendar の不要な再バインドを防ぐ
  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      openTaskDrawer(resolveTaskId(arg.event.id))
    },
    [openTaskDrawer]
  )

  // Issue #6: try/catch で uncaught promise rejection を防ぎ、失敗時は必ず revert
  // 繰り返し展開イベントのドロップは基準 dueDate を更新する
  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      if (!isAuthenticated) {
        arg.revert()
        return
      }
      const newDate = arg.event.start
      if (!newDate) {
        arg.revert()
        return
      }
      try {
        const result = await taskRepo.update(resolveTaskId(arg.event.id), { dueDate: newDate })
        if (!result.ok) {
          arg.revert()
          console.error('[CalendarView] dueDate 更新失敗:', result.error)
        } else {
          if (selectedProjectId) {
            updateProjectTask(selectedProjectId, result.data)
            invalidateProjectTasks(selectedProjectId)
          }
        }
      } catch (e) {
        arg.revert()
        console.error('[CalendarView] dueDate 更新中に予期しないエラー:', e)
      }
    },
    [invalidateProjectTasks, isAuthenticated, selectedProjectId, updateProjectTask]
  )

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    // topicId が不明なため新規タスク作成は行わず選択解除のみ
    arg.view.calendar.unselect()
  }, [])

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <FullCalendar
        plugins={FC_PLUGINS}
        initialView="dayGridMonth"
        headerToolbar={FC_HEADER_TOOLBAR}
        locale="ja"
        height="100%"
        events={events}
        editable={isAuthenticated}
        selectable={isAuthenticated}
        selectMirror
        dayMaxEvents
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        select={handleDateSelect}
        datesSet={handleDatesSet}
        buttonText={FC_BUTTON_TEXT}
      />
    </div>
  )
}

// React.lazy 用のデフォルトエクスポート
export default CalendarView
