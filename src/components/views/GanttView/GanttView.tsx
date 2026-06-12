import { useRef, useCallback, useState, useMemo } from 'react'
import { FolderOpen } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useUIStore } from '@/store/uiStore'
import { useGanttData } from '@/hooks/useGanttData'
import { GanttHeader } from './GanttHeader'
import { GanttRow } from './GanttRow'
import { GanttTodayLine } from './GanttTodayLine'
import { useGanttDrag, calcGanttRange } from './useGanttDrag'
import type { GanttScale } from './ganttConstants'
import { PIXELS_PER_DAY, ROW_HEIGHT, HEADER_HEIGHT, LEFT_PANE_WIDTH } from './ganttConstants'
import type { Task } from '@/types'

const SCALE_LABELS: Record<GanttScale, string> = {
  day: '日',
  week: '週',
  month: '月',
}

const TOPIC_ROW_HEIGHT = 28

interface FlatRow {
  type: 'topic' | 'task-row'
  label: string
  tasks: Task[] // task-row の場合は必ず1要素
}

export function GanttView() {
  const { selectedProjectId, openTaskDrawer } = useUIStore()
  const ganttRows = useGanttData(selectedProjectId)
  const [scale, setScale] = useState<GanttScale>('week')

  const ppd = PIXELS_PER_DAY[scale]

  const { startDate, totalDays } = useMemo(
    () =>
      ganttRows.length > 0 ? calcGanttRange(ganttRows) : { startDate: new Date(), totalDays: 60 },
    [ganttRows]
  )

  const { preview, onBarPointerDown } = useGanttDrag(startDate, scale)

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const { topic, tasks } of ganttRows) {
      rows.push({ type: 'topic', label: topic.name, tasks: [] })
      for (const task of tasks) {
        rows.push({ type: 'task-row', label: task.title, tasks: [task] })
      }
    }
    return rows
  }, [ganttRows])

  // #7: preview 適用をここで一括計算（仮想アイテムのレンダリング内で毎回走らせない）
  const displayedFlatRows = useMemo<FlatRow[]>(() => {
    if (preview.size === 0) return flatRows
    return flatRows.map((row) => {
      if (row.type === 'topic') return row
      const tasks = row.tasks.map((task) => {
        const p = preview.get(task.id)
        return p ? { ...task, ...p } : task
      })
      return { ...row, tasks }
    })
  }, [flatRows, preview])

  // 縦スクロール同期用 refs
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  // #3: requestAnimationFrame でフラグリセットを次フレームに遅延させ、連続スクロールでのスタッター防止
  const syncLeft = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    requestAnimationFrame(() => {
      if (rightScrollRef.current && leftScrollRef.current) {
        rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop
      }
      syncingRef.current = false
    })
  }, [])

  const syncRight = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    requestAnimationFrame(() => {
      if (leftScrollRef.current && rightScrollRef.current) {
        leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop
      }
      syncingRef.current = false
    })
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => rightScrollRef.current,
    estimateSize: (i) => (flatRows[i].type === 'topic' ? TOPIC_ROW_HEIGHT : ROW_HEIGHT),
    overscan: 5,
    scrollPaddingStart: HEADER_HEIGHT,
  })

  if (!selectedProjectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">左のサイドバーからプロジェクトを選択してください</p>
      </div>
    )
  }

  const totalWidth = totalDays * ppd

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* スケール切替ツールバー */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-2">
        <span className="mr-2 text-xs text-muted-foreground">スケール:</span>
        {(['day', 'week', 'month'] as GanttScale[]).map((s) => (
          <button
            key={s}
            onClick={() => setScale(s)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              scale === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {SCALE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* メインエリア（左ペイン + 右ペイン） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左ペイン: タスク名リスト */}
        <div
          className="relative shrink-0 overflow-y-auto overflow-x-hidden border-r border-border"
          ref={leftScrollRef}
          style={{ width: LEFT_PANE_WIDTH }}
          onScroll={syncLeft}
        >
          <div
            className="sticky top-0 z-10 border-b border-border bg-muted/50"
            style={{ height: HEADER_HEIGHT }}
          />
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const row = flatRows[vi.index]
              return (
                <div
                  key={vi.index}
                  className={`absolute left-0 right-0 flex items-center border-b border-border px-3 ${
                    row.type === 'topic'
                      ? 'bg-muted/50 text-xs font-semibold text-muted-foreground'
                      : 'text-sm text-foreground'
                  }`}
                  style={{ top: vi.start, height: vi.size }}
                >
                  <span className="truncate">{row.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右ペイン: タイムライン（ヘッダー + 本体を同一スクロールコンテナに入れ横スクロールを同期） */}
        <div ref={rightScrollRef} className="flex-1 overflow-auto" onScroll={syncRight}>
          {/* sticky ヘッダー: 縦スクロールで固定、横は本体と同期 */}
          <div className="sticky top-0 z-10" style={{ width: totalWidth, height: HEADER_HEIGHT }}>
            <GanttHeader startDate={startDate} totalDays={totalDays} scale={scale} />
          </div>

          <div
            className="relative"
            style={{ width: totalWidth, height: rowVirtualizer.getTotalSize() }}
          >
            <GanttTodayLine ganttStart={startDate} totalDays={totalDays} scale={scale} />

            {rowVirtualizer.getVirtualItems().map((vi) => {
              const row = displayedFlatRows[vi.index]
              if (row.type === 'topic') {
                return (
                  <div
                    key={vi.index}
                    className="absolute left-0 right-0 border-b border-border bg-muted/30"
                    style={{ top: vi.start, height: vi.size, width: totalWidth }}
                  />
                )
              }
              return (
                <div
                  key={vi.index}
                  className="absolute left-0"
                  style={{ top: vi.start, height: vi.size, width: totalWidth }}
                >
                  <GanttRow
                    tasks={row.tasks}
                    totalDays={totalDays}
                    ganttStart={startDate}
                    scale={scale}
                    onBarPointerDown={onBarPointerDown}
                    onBarClick={openTaskDrawer}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GanttView
