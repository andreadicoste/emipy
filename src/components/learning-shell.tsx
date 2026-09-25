import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon, LayoutAlignLeftIcon, LayoutAlignRightIcon, LayoutLeftIcon, LayoutRightIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppSidebar } from './app-sidebar'
import { TutorPanel } from './tutor-panel'

export function LearningShell({ children, active }: {
  children: ReactNode
  active: 'courses' | 'library'
}) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [animatedPanel, setAnimatedPanel] = useState<'left' | 'right' | null>(null)
  const leftRef = usePanelRef(), rightRef = usePanelRef()
  const shellRef = useGroupRef(), workspaceRef = useGroupRef()
  const layoutReady = useRef(false)
  const animationFrame = useRef<number | null>(null)
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const shell = localStorage.getItem('emipy-layout-shell')
      const workspace = localStorage.getItem('emipy-layout-workspace')
      if (shell) shellRef.current?.setLayout(JSON.parse(shell))
      if (workspace) workspaceRef.current?.setLayout(JSON.parse(workspace))
      if (!shell && innerWidth < 1024) leftRef.current?.collapse()
      if (!workspace && innerWidth < 1024) rightRef.current?.collapse()
    } catch { /* old layout */ } finally { layoutReady.current = true }
  }, [shellRef, workspaceRef, leftRef, rightRef])

  useEffect(() => () => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
  }, [])

  function togglePanel(panel: 'left' | 'right') {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
    setAnimatedPanel(panel)
    animationFrame.current = requestAnimationFrame(() => {
      const ref = panel === 'left' ? leftRef : rightRef
      if (ref.current?.isCollapsed()) ref.current.expand()
      else ref.current?.collapse()
      animationFrame.current = null
      animationTimeout.current = setTimeout(() => { setAnimatedPanel(null); animationTimeout.current = null }, 240)
    })
  }

  const title = active === 'courses' ? 'corsi' : 'libreria'

  return <main className="ide-root bg-[var(--ide-canvas)]"><Group orientation="horizontal" groupRef={shellRef} className={`h-full ${animatedPanel === 'left' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-shell', JSON.stringify(layout)) }}>
    <Panel id="programs" panelRef={leftRef} defaultSize="16%" minSize={180} maxSize="35%" collapsible collapsedSize={0} onResize={(size) => setLeftOpen(size.inPixels > 0)}><AppSidebar active={active} /></Panel>
    <Separator className="ide-handle ide-side-handle w-px" />
    <Panel id="shell" minSize="45%" className="flex min-w-0 flex-col">
      <header className="ide-toolbar flex h-12 shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3">
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={leftOpen ? 'Nascondi navigazione' : 'Mostra navigazione'} onClick={() => togglePanel('left')}><HugeiconsIcon icon={leftOpen ? LayoutLeftIcon : LayoutAlignLeftIcon} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{leftOpen ? 'Nascondi navigazione' : 'Mostra navigazione'}</TooltipContent></Tooltip>
        <span className="ide-file-tab ide-file-tab-active flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium"><HugeiconsIcon icon={File01Icon} className="size-3.5" aria-hidden="true" />{title}</span>
        <div className="min-w-0 flex-1" />
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={rightOpen ? 'Nascondi Tutor' : 'Mostra Tutor'} onClick={() => togglePanel('right')}><HugeiconsIcon icon={rightOpen ? LayoutRightIcon : LayoutAlignRightIcon} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{rightOpen ? 'Nascondi Tutor' : 'Mostra Tutor'}</TooltipContent></Tooltip>
      </header>
      <Group orientation="horizontal" groupRef={workspaceRef} className={`min-h-0 flex-1 ${animatedPanel === 'right' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-workspace', JSON.stringify(layout)) }}>
        <Panel id="workspace" minSize="35%" className="flex min-w-0 flex-col pb-1 pl-2 pr-2"><section className="ide-surface app-view-enter min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">{children}</section></Panel>
        <Separator className="ide-handle ide-side-handle ide-files-handle w-px" />
        <Panel id="files" panelRef={rightRef} defaultSize="18%" minSize={220} maxSize="40%" collapsible collapsedSize={0} onResize={(size) => setRightOpen(size.inPixels > 0)}><TutorPanel context={null} /></Panel>
      </Group>
    </Panel>
  </Group></main>
}
