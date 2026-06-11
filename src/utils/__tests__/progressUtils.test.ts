import { describe, it, expect } from 'vitest'
import { calcProgress, calcProjectProgress } from '../progressUtils'

describe('calcProgress', () => {
  it('サブタスクが空の場合は0を返す', () => {
    expect(calcProgress([])).toBe(0)
  })

  it('全完了なら100を返す', () => {
    expect(calcProgress([true, true, true])).toBe(100)
  })

  it('全未完了なら0を返す', () => {
    expect(calcProgress([false, false])).toBe(0)
  })

  it('半分完了なら50を返す', () => {
    expect(calcProgress([true, false, true, false])).toBe(50)
  })

  it('端数は整数に切り捨てる', () => {
    expect(calcProgress([true, false, false])).toBe(33)
  })
})

describe('calcProjectProgress', () => {
  it('タスクが空なら0を返す', () => {
    expect(calcProjectProgress([])).toBe(0)
  })

  it('全タスクが done なら100を返す', () => {
    expect(calcProjectProgress(['done', 'done'])).toBe(100)
  })

  it('全タスクが todo なら0を返す', () => {
    expect(calcProjectProgress(['todo', 'todo'])).toBe(0)
  })

  it('done と todo が半々なら50を返す', () => {
    expect(calcProjectProgress(['done', 'todo'])).toBe(50)
  })

  it('in_progress は未完了として扱う', () => {
    expect(calcProjectProgress(['done', 'in_progress'])).toBe(50)
  })
})
