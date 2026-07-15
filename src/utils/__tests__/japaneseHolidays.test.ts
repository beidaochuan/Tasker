import { describe, expect, it } from 'vitest'
import { getJapaneseHolidayName } from '../japaneseHolidays'

describe('getJapaneseHolidayName', () => {
  it('matches the Cabinet Office holiday dates for 2026 and 2027', () => {
    const expectedDates = [
      '2026-01-01',
      '2026-01-12',
      '2026-02-11',
      '2026-02-23',
      '2026-03-20',
      '2026-04-29',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-07-20',
      '2026-08-11',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-10-12',
      '2026-11-03',
      '2026-11-23',
      '2027-01-01',
      '2027-01-11',
      '2027-02-11',
      '2027-02-23',
      '2027-03-21',
      '2027-03-22',
      '2027-04-29',
      '2027-05-03',
      '2027-05-04',
      '2027-05-05',
      '2027-07-19',
      '2027-08-11',
      '2027-09-20',
      '2027-09-23',
      '2027-10-11',
      '2027-11-03',
      '2027-11-23',
    ]

    expectedDates.forEach((date) => {
      expect(getJapaneseHolidayName(new Date(`${date}T00:00:00`)), date).not.toBeNull()
    })
  })

  it('returns fixed and Happy Monday holidays', () => {
    expect(getJapaneseHolidayName(new Date(2026, 0, 1))).toBe('元日')
    expect(getJapaneseHolidayName(new Date(2026, 6, 20))).toBe('海の日')
  })

  it('returns substitute holidays after consecutive Golden Week holidays', () => {
    expect(getJapaneseHolidayName(new Date(2026, 4, 6))).toBe('振替休日')
  })

  it('returns a weekday between two national holidays as a public holiday', () => {
    expect(getJapaneseHolidayName(new Date(2026, 8, 22))).toBe('国民の休日')
  })

  it('does not treat an ordinary weekend as a public holiday', () => {
    expect(getJapaneseHolidayName(new Date(2026, 6, 18))).toBeNull()
    expect(getJapaneseHolidayName(new Date(2026, 6, 19))).toBeNull()
  })

  it('supports the Olympic holiday exceptions', () => {
    expect(getJapaneseHolidayName(new Date(2021, 6, 22))).toBe('海の日')
    expect(getJapaneseHolidayName(new Date(2021, 7, 9))).toBe('振替休日')
  })
})
