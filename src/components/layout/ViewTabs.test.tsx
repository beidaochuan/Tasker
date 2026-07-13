import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useUIStore } from '@/store/uiStore'
import { ViewTabs } from './ViewTabs'

describe('ViewTabs', () => {
  afterEach(() => {
    cleanup()
  })

  it('ガントをリストの直後に表示する', () => {
    useUIStore.setState({ activeView: 'list' })

    render(<ViewTabs />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'リスト',
      'ガント',
      'カンバン',
      'カレンダー',
    ])
  })
})
