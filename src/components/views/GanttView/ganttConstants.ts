export type GanttScale = 'day' | 'week' | 'month'

export const PIXELS_PER_DAY: Record<GanttScale, number> = {
  day: 40,
  week: 20,
  month: 8,
}

export const ROW_HEIGHT = 36
export const HEADER_HEIGHT = 48
export const LEFT_PANE_WIDTH = 220
export const RESIZE_HANDLE_WIDTH = 8
