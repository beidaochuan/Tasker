import { describe, it, expect } from 'vitest'
import { toUnixMs, fromUnixMs, isOverdue, isDueToday, isDueSoon, formatDate } from '../dateUtils'

const DAY = 24 * 60 * 60 * 1000

describe('toUnixMs / fromUnixMs', () => {
  it('Date → number → Date でラウンドトリップ', () => {
    const d = new Date(2024, 0, 15, 12, 0, 0, 0)
    expect(fromUnixMs(toUnixMs(d))).toEqual(d)
  })
})

describe('isOverdue', () => {
  it('過去の日付は true', () => {
    const past = new Date(Date.now() - DAY)
    expect(isOverdue(past)).toBe(true)
  })

  it('未来の日付は false', () => {
    const future = new Date(Date.now() + DAY)
    expect(isOverdue(future)).toBe(false)
  })

  it('dueDate が null なら false', () => {
    expect(isOverdue(null)).toBe(false)
  })
})

describe('isDueToday', () => {
  it('今日の日付は true', () => {
    const now = new Date()
    expect(isDueToday(now)).toBe(true)
  })

  it('昨日は false', () => {
    const yesterday = new Date(Date.now() - DAY)
    expect(isDueToday(yesterday)).toBe(false)
  })

  it('明日は false', () => {
    const tomorrow = new Date(Date.now() + DAY)
    expect(isDueToday(tomorrow)).toBe(false)
  })
})

describe('isDueSoon', () => {
  it('3日以内は true', () => {
    const soon = new Date(Date.now() + 2 * DAY)
    expect(isDueSoon(soon, 3)).toBe(true)
  })

  it('4日後は false（3日閾値）', () => {
    const later = new Date(Date.now() + 4 * DAY)
    expect(isDueSoon(later, 3)).toBe(false)
  })

  it('過去は false（期限切れ扱いなので「近い」ではない）', () => {
    const past = new Date(Date.now() - DAY)
    expect(isDueSoon(past, 3)).toBe(false)
  })
})

describe('formatDate', () => {
  it('yyyy/MM/dd 形式で返す', () => {
    const d = new Date(2024, 0, 5)
    expect(formatDate(d)).toBe('2024/01/05')
  })

  it('null なら空文字を返す', () => {
    expect(formatDate(null)).toBe('')
  })
})
