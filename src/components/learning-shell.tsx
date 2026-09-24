import type { ReactNode } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { AppSidebar } from './app-sidebar'

export function LearningShell({ children, active }: {
  children: ReactNode
  active: 'courses' | 'library'
}) {
  return <main className="ide-root bg-[var(--ide-canvas)]"><Group orientation="horizontal" className="h-full">
    <Panel defaultSize="16%" minSize={180} maxSize="28%"><AppSidebar active={active} /></Panel>
    <Separator className="ide-handle ide-side-handle w-px" />
    <Panel minSize="45%" className="min-w-0"><div className="app-view-enter h-full overflow-y-auto">{children}</div></Panel>
  </Group></main>
}
