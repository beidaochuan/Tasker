import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  // resetKey を変更すると ErrorBoundary が子を強制再マウントする
  resetKey?: unknown
}

interface State {
  hasError: boolean
  error: Error | null
  // resetKey の前回値を保持して getDerivedStateFromProps でリセットを検知する
  prevResetKey: unknown
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, prevResetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.prevResetKey) {
      return { hasError: false, error: null, prevResetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">予期しないエラーが発生しました</p>
            <p className="mt-1 text-xs text-muted-foreground">{this.state.error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            画面をリセット
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
