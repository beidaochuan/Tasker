import { describe, it, expect } from 'vitest'
import {
  buildRRule,
  parseRRule,
  getNextOccurrence,
  hasRepeatRule,
  describeRRule,
} from '@/utils/recurrenceUtils'

// rrule は UTC 基準で計算するため、テストは UTC 固定の Date を使う
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

describe('buildRRule', () => {
  it('毎日繰り返しの RRULE 文字列を生成する', () => {
    const rule = buildRRule({ freq: 'DAILY', interval: 1 })
    expect(rule).toBe('RRULE:FREQ=DAILY;INTERVAL=1')
  })

  it('毎週繰り返しの RRULE 文字列を生成する', () => {
    const rule = buildRRule({ freq: 'WEEKLY', interval: 1 })
    expect(rule).toContain('FREQ=WEEKLY')
    expect(rule).toContain('INTERVAL=1')
  })

  it('毎月繰り返しの RRULE 文字列を生成する', () => {
    const rule = buildRRule({ freq: 'MONTHLY', interval: 1 })
    expect(rule).toContain('FREQ=MONTHLY')
  })

  it('2週間ごとの RRULE 文字列を生成する', () => {
    const rule = buildRRule({ freq: 'WEEKLY', interval: 2 })
    expect(rule).toContain('FREQ=WEEKLY')
    expect(rule).toContain('INTERVAL=2')
  })

  it('interval に 0 を渡すと RangeError をスローする', () => {
    expect(() => buildRRule({ freq: 'DAILY', interval: 0 })).toThrow(RangeError)
  })

  it('interval に負数を渡すと RangeError をスローする', () => {
    expect(() => buildRRule({ freq: 'DAILY', interval: -1 })).toThrow(RangeError)
  })
})

describe('parseRRule', () => {
  it('有効な RRULE 文字列をパースできる', () => {
    const result = parseRRule('RRULE:FREQ=DAILY;INTERVAL=1')
    expect(result).not.toBeNull()
    expect(result?.freq).toBe('DAILY')
    expect(result?.interval).toBe(1)
  })

  it('null を渡すと null を返す', () => {
    expect(parseRRule(null)).toBeNull()
  })

  it('空文字を渡すと null を返す', () => {
    expect(parseRRule('')).toBeNull()
  })

  it('不正な文字列を渡すと null を返す', () => {
    expect(parseRRule('invalid')).toBeNull()
  })
})

describe('getNextOccurrence', () => {
  it('毎日ルールで翌日を返す', () => {
    const base = utcDate(2026, 1, 10)
    const next = getNextOccurrence('RRULE:FREQ=DAILY;INTERVAL=1', base)
    expect(next).not.toBeNull()
    // 翌日 = 2026-01-11
    expect(next!.getUTCFullYear()).toBe(2026)
    expect(next!.getUTCMonth()).toBe(0) // 0-indexed
    expect(next!.getUTCDate()).toBe(11)
  })

  it('2日ごとのルールで2日後を返す', () => {
    const base = utcDate(2026, 1, 10)
    const next = getNextOccurrence('RRULE:FREQ=DAILY;INTERVAL=2', base)
    expect(next).not.toBeNull()
    expect(next!.getUTCDate()).toBe(12)
  })

  it('毎週ルールで7日後を返す', () => {
    const base = utcDate(2026, 1, 5) // 月曜日
    const next = getNextOccurrence('RRULE:FREQ=WEEKLY;INTERVAL=1', base)
    expect(next).not.toBeNull()
    expect(next!.getUTCDate()).toBe(12)
  })

  it('null を渡すと null を返す', () => {
    expect(getNextOccurrence(null, new Date())).toBeNull()
  })

  it('不正な RRULE を渡すと null を返す', () => {
    expect(getNextOccurrence('invalid', new Date())).toBeNull()
  })

  it('月末ロールオーバー: 1月31日の翌日は2月1日', () => {
    const base = utcDate(2026, 1, 31)
    const next = getNextOccurrence('RRULE:FREQ=DAILY;INTERVAL=1', base)
    expect(next).not.toBeNull()
    expect(next!.getUTCMonth()).toBe(1) // 2月（0-indexed）
    expect(next!.getUTCDate()).toBe(1)
  })

  it('うるう年: 2024-02-28 の翌日は 2024-02-29', () => {
    const base = utcDate(2024, 2, 28)
    const next = getNextOccurrence('RRULE:FREQ=DAILY;INTERVAL=1', base)
    expect(next).not.toBeNull()
    expect(next!.getUTCFullYear()).toBe(2024)
    expect(next!.getUTCMonth()).toBe(1) // 2月
    expect(next!.getUTCDate()).toBe(29)
  })
})

describe('hasRepeatRule', () => {
  it('有効な RRULE 文字列のとき true を返す', () => {
    expect(hasRepeatRule('RRULE:FREQ=DAILY;INTERVAL=1')).toBe(true)
  })

  it('null のとき false を返す', () => {
    expect(hasRepeatRule(null)).toBe(false)
  })

  it('空文字のとき false を返す', () => {
    expect(hasRepeatRule('')).toBe(false)
  })

  it('undefined のとき false を返す', () => {
    expect(hasRepeatRule(undefined)).toBe(false)
  })
})

describe('describeRRule', () => {
  it('毎日ルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=DAILY;INTERVAL=1')).toBe('毎日')
  })

  it('2日ごとのルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=DAILY;INTERVAL=2')).toBe('2日ごと')
  })

  it('毎週ルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=WEEKLY;INTERVAL=1')).toBe('毎週')
  })

  it('2週間ごとのルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=WEEKLY;INTERVAL=2')).toBe('2週間ごと')
  })

  it('毎月ルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=MONTHLY;INTERVAL=1')).toBe('毎月')
  })

  it('毎年ルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=YEARLY;INTERVAL=1')).toBe('毎年')
  })

  it('2年ごとのルールを日本語で説明する', () => {
    expect(describeRRule('RRULE:FREQ=YEARLY;INTERVAL=2')).toBe('2年ごと')
  })

  it('null を渡すと空文字を返す', () => {
    expect(describeRRule(null)).toBe('')
  })
})
