import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GanttDayBackground } from './GanttDayBackground'

describe('GanttDayBackground', () => {
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
})
