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
})
