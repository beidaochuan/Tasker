import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useUIStore } from '@/store/uiStore'
import { ViewTabs } from './ViewTabs'

describe('ViewTabs', () => {
  afterEach(() => {
    cleanup()
  })

  it('カンバン、ガント、リスト、カレンダーの順に表示する', () => {
    useUIStore.setState({ activeView: 'list' })

    render(<ViewTabs />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'カンバン',
      'ガント',
      'リスト',
      'カレンダー',
    ])
  })

  it('ナビゲーション面と選択中タブを背景色でも区別する', () => {
    useUIStore.setState({ activeView: 'list' })

    const { container } = render(<ViewTabs />)

    expect(container.firstChild).toHaveClass('bg-panel')
    expect(screen.getByRole('button', { name: 'リスト' })).toHaveClass('bg-primary/5')
  })
})
