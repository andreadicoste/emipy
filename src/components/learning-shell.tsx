import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { HugeiconsIcon } from '@hugeicons/react'
import { BorderAll02Icon, LayoutAlignLeftIcon, LayoutLeftIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AppSidebar } from './app-sidebar'
import { useLayoutPreferences } from '@/lib/layout-preferences'

export function LearningShell({ children, active }: {
  children: ReactNode
  active: 'courses' | 'library'
}) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [mobileView, setMobileView] = useState<'navigation' | 'content'>('content')
  const [animatedPanel, setAnimatedPanel] = useState(false)
  const { layouts, saveLayout } = useLayoutPreferences()
  const leftRef = usePanelRef()
  const shellRef = useGroupRef()
  const layoutReady = useRef(false)
  const animationFrame = useRef<number | null>(null)
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) { layoutReady.current = true; return }
    try {
      const shell = localStorage.getItem('emipy-layout-shell')
      if (shell && !layouts.shell) { const layout = JSON.parse(shell); shellRef.current?.setLayout(layout); saveLayout('shell', layout) }
    } catch { /* old layout */ } finally { layoutReady.current = true }
  }, [shellRef, layouts.shell, saveLayout])

  useEffect(() => () => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
  }, [])

  function togglePanel() {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileView((view) => view === 'navigation' ? 'content' : 'navigation')
      return
    }
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
    setAnimatedPanel(true)
    animationFrame.current = requestAnimationFrame(() => {
      if (leftRef.current?.isCollapsed()) leftRef.current.expand()
      else leftRef.current?.collapse()
      animationFrame.current = null
      animationTimeout.current = setTimeout(() => { setAnimatedPanel(false); animationTimeout.current = null }, 240)
    })
  }

  const title = active === 'courses' ? 'Corsi' : 'Libreria'

  return <main className="ide-root mobile-carousel bg-[var(--ide-canvas)]" data-mobile-view={mobileView}><Group orientation="horizontal" groupRef={shellRef} defaultLayout={layouts.shell} className={`mobile-carousel-track h-full ${animatedPanel ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current && !window.matchMedia('(max-width: 1023px)').matches) saveLayout('shell', layout) }}>
    <Panel id="programs" panelRef={leftRef} defaultSize="16%" minSize={180} maxSize="35%" collapsible collapsedSize={0} className="mobile-nav-panel" onResize={(size) => setLeftOpen(size.inPixels > 0)} onClickCapture={(event) => { if ((event.target as HTMLElement).closest('nav button')) setMobileView('content') }}><Button type="button" variant="ghost" size="icon-sm" className="mobile-side-dismiss lg:hidden" aria-label="Torna al contenuto" onClick={() => setMobileView('content')}><HugeiconsIcon icon={BorderAll02Icon} aria-hidden="true" /></Button><AppSidebar active={active} /></Panel>
    <Separator className="ide-handle ide-side-handle w-px" />
    <Panel id="shell" minSize="45%" className="mobile-shell-panel flex min-w-0 flex-col">
      <header className="ide-toolbar flex h-12 shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3">
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className="mobile-panel-toggle" aria-label={leftOpen ? 'Nascondi navigazione' : 'Mostra navigazione'} onClick={togglePanel}><HugeiconsIcon icon={leftOpen ? LayoutLeftIcon : LayoutAlignLeftIcon} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{leftOpen ? 'Nascondi navigazione' : 'Mostra navigazione'}</TooltipContent></Tooltip>
        <span className="px-1 text-sm font-semibold">{title}</span>
      </header>
      <section className="ide-surface app-view-enter mb-1 ml-2 mr-2 min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">{children}</section>
    </Panel>
  </Group></main>
}
