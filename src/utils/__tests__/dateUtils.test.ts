import { describe, it, expect, vi } from 'vitest'
import {
  toUnixMs,
  fromUnixMs,
  isOverdue,
  getOverdueDays,
  isDueToday,
  isDueSoon,
  formatDate,
  formatDateInput,
  parseDateInput,
} from '../dateUtils'

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

describe('getOverdueDays', () => {
  it('期限を過ぎた日数を日単位で返す', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-07-15T12:00:00'))

      expect(getOverdueDays(new Date('2026-07-12T23:59:59'))).toBe(3)
      expect(getOverdueDays(new Date('2026-07-15T00:00:00'))).toBe(0)
      expect(getOverdueDays(new Date('2026-07-16T00:00:00'))).toBe(0)
      expect(getOverdueDays(null)).toBe(0)
    } finally {
      vi.useRealTimers()
    }
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

describe('date input helpers', () => {
  it('ローカル日付として yyyy-MM-dd に整形する', () => {
    const d = new Date(2024, 0, 5)
    expect(formatDateInput(d)).toBe('2024-01-05')
  })

  it('yyyy-MM-dd をローカル日付としてパースする', () => {
    const d = parseDateInput('2024-01-05')
    expect(d).toEqual(new Date(2024, 0, 5))
  })

  it('yyyy/MM/dd をローカル日付としてパースする', () => {
    const d = parseDateInput('2024/01/05')
    expect(d).toEqual(new Date(2024, 0, 5))
  })

  it('前後の空白を無視してパースする', () => {
    const d = parseDateInput(' 2024/1/5 ')
    expect(d).toEqual(new Date(2024, 0, 5))
  })

  it('不正な日付は null を返す', () => {
    expect(parseDateInput('2024-02-31')).toBeNull()
  })
})
