import type { ReactNode } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { AppSidebar } from './app-sidebar'
import { TutorPanel } from './tutor-panel'

export function LearningShell({ children, active, course, lessons, currentLessonId, showTutor = false }: {
  children: ReactNode
  active: 'courses' | 'library'
  course?: { externalId: string; title: string }
  lessons?: { externalId: string; title: string; visited: boolean }[]
  currentLessonId?: string
  showTutor?: boolean
}) {
  return <main className="ide-root bg-[var(--ide-canvas)]"><Group orientation="horizontal" className="h-full">
    <Panel defaultSize="16%" minSize={180} maxSize="28%"><AppSidebar active={active} course={course} lessons={lessons} currentLessonId={currentLessonId} /></Panel>
    <Separator className="ide-handle ide-side-handle w-px" />
    <Panel minSize="45%" className="min-w-0"><div className="app-view-enter h-full overflow-y-auto">{children}</div></Panel>
    {showTutor && <><Separator className="ide-handle ide-side-handle w-px" /><Panel defaultSize="18%" minSize={210} maxSize="35%" collapsible collapsedSize={0}><TutorPanel /></Panel></>}
  </Group></main>
}
