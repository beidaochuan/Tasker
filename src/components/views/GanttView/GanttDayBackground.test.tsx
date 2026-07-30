import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GanttDayBackground } from './GanttDayBackground'

describe('GanttDayBackground', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aligns the weekly colors with the start weekday and overlays public holidays', () => {
    const { container } = render(
      <div className="relative h-10">
        <GanttDayBackground startDate={new Date(2026, 6, 17)} totalDays={4} scale="day" />
      </div>
    )

    const background = container.querySelector('[aria-hidden="true"]')
    expect(background).toHaveStyle({
      width: '160px',
      backgroundPosition: '-160px 0',
      backgroundSize: '280px 100%',
    })

    const holidayColumn = background?.querySelector('span')
    expect(holidayColumn).toHaveStyle({ left: '120px', width: '40px' })
  })

  it('今日の列を薄い背景色で強調する', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 30, 12))

    const { container } = render(
      <div className="relative h-10">
        <GanttDayBackground startDate={new Date(2026, 6, 29)} totalDays={3} scale="day" />
      </div>
    )

    const todayColumn = container.querySelector('[data-today="true"]')
    expect(todayColumn).toHaveClass('bg-border/30', 'dark:bg-border/40')
    expect(todayColumn).toHaveStyle({ left: '40px', width: '40px' })
  })
})
