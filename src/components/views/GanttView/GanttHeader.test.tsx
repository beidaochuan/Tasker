import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GanttHeader } from './GanttHeader'

describe('GanttHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows abbreviated Japanese weekdays in day scale', () => {
    render(<GanttHeader startDate={new Date(2026, 6, 6)} totalDays={3} scale="day" />)

    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('火')).toBeInTheDocument()
    expect(screen.getByText('水')).toBeInTheDocument()
  })

  it('keeps week scale labels without daily weekdays', () => {
    render(<GanttHeader startDate={new Date(2026, 6, 6)} totalDays={7} scale="week" />)

    expect(screen.queryByText('月')).not.toBeInTheDocument()
  })

  it('colors Saturdays blue and Sundays and Japanese holidays red', () => {
    render(<GanttHeader startDate={new Date(2026, 6, 18)} totalDays={4} scale="day" />)

    expect(screen.getByTitle('2026年7月18日 土曜日')).toHaveClass('text-blue-600')
    expect(screen.getByTitle('2026年7月19日 日曜日')).toHaveClass('text-red-600')
    expect(screen.getByTitle('2026年7月20日 海の日')).toHaveClass('text-red-600')
  })
})
