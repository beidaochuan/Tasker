import type React from 'react'
import { Sidebar } from './Sidebar'
import { ViewTabs } from './ViewTabs'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ViewTabs />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
