import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ChangeScreenModeIcon, Delete02Icon, Edit02Icon, File01Icon, Logout01Icon,
  LayoutAlignBottomIcon, LayoutAlignLeftIcon, LayoutAlignRightIcon,
  LayoutBottomIcon, LayoutLeftIcon, LayoutRightIcon, Moon02Icon,
  MoreHorizontalIcon, PlayIcon, PlusSignIcon, Settings02Icon, StopIcon,
  Sun03Icon, TerminalIcon, UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { authClient } from '@/lib/auth-client'
import { createProgram, deleteProgram, renameProgram, type getProgram, type listPrograms } from '@/lib/programs.functions'
import { useAutosave } from '@/hooks/use-autosave'
import { usePython } from '@/hooks/use-python'

const CodeEditor = lazy(() => import('./code-editor').then((module) => ({ default: module.CodeEditor })))
type Program = Awaited<ReturnType<typeof getProgram>>
type ProgramSummary = Awaited<ReturnType<typeof listPrograms>>[number]
type IconType = Parameters<typeof HugeiconsIcon>[0]['icon']

function Icon({ icon, className }: { icon: IconType; className?: string }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} aria-hidden="true" />
}

function IconButton({ icon, label, onClick }: { icon: IconType; label: string; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}><Icon icon={icon} /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
}

export function Ide({ program, programs }: { program: Program; programs: ProgramSummary[] }) {
  const navigate = useNavigate()
  const router = useRouter()
  const { user } = useRouteContext({ from: '/app' })
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newName, setNewName] = useState(program.name)
  const [fileSearch, setFileSearch] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [outputOpen, setOutputOpen] = useState(true)
  const [animatedPanel, setAnimatedPanel] = useState<'left' | 'right' | 'output' | null>(null)
  const autosave = useAutosave(program.id, program.code)
  const python = usePython()
  const leftRef = usePanelRef()
  const rightRef = usePanelRef()
  const outputRef = usePanelRef()
  const shellRef = useGroupRef()
  const workspaceRef = useGroupRef()
  const verticalRef = useGroupRef()
  const layoutReady = useRef(false)
  const outputEnd = useRef<HTMLDivElement | null>(null)
  const animationFrame = useRef<number | null>(null)
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const shell = localStorage.getItem('emipy-layout-shell')
      const workspace = localStorage.getItem('emipy-layout-workspace')
      const vertical = localStorage.getItem('emipy-layout-vertical')
      if (shell) shellRef.current?.setLayout(JSON.parse(shell))
      if (workspace) workspaceRef.current?.setLayout(JSON.parse(workspace))
      if (vertical) verticalRef.current?.setLayout(JSON.parse(vertical))
      if (!shell && innerWidth < 1024) leftRef.current?.collapse()
      if (!workspace && innerWidth < 1024) rightRef.current?.collapse()
    } catch { /* Invalid old layout: use defaults. */ }
    finally { layoutReady.current = true }
  }, [shellRef, workspaceRef, leftRef, rightRef, verticalRef])

  useEffect(() => { outputEnd.current?.scrollIntoView({ block: 'end' }) }, [python.output])
  useEffect(() => { if (autosave.status === 'error') toast.error('Salvataggio non riuscito. Modifica il codice per riprovare.') }, [autosave.status])
  useEffect(() => () => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
  }, [])

  function togglePanel(panel: 'left' | 'right' | 'output') {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
    setAnimatedPanel(panel)
    animationFrame.current = requestAnimationFrame(() => {
      const ref = panel === 'left' ? leftRef : panel === 'right' ? rightRef : outputRef
      if (ref.current?.isCollapsed()) ref.current.expand()
      else ref.current?.collapse()
      animationFrame.current = null
      animationTimeout.current = setTimeout(() => {
        setAnimatedPanel(null)
        animationTimeout.current = null
      }, 240)
    })
  }

  async function openProgram(id: string) {
    if (id === program.id) return
    try { await autosave.flush(); await navigate({ to: '/app/$programId', params: { programId: id } }) }
    catch { toast.error('Salvataggio non riuscito. Riprova prima di cambiare programma.') }
  }

  async function create() {
    try {
      await autosave.flush()
      const next = await createProgram({ data: {} })
      await navigate({ to: '/app/$programId', params: { programId: next.id } })
      await router.invalidate()
    } catch { toast.error('Impossibile creare il programma.') }
  }

  async function rename() {
    setBusy(true)
    try { await renameProgram({ data: { id: program.id, name: newName } }); setRenameOpen(false); await router.invalidate(); toast.success('Programma rinominato.') }
    catch { toast.error('Nome non valido o rinomina non riuscita.') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteProgram({ data: { id: program.id } })
      setDeleteOpen(false)
      const next = programs.find((item) => item.id !== program.id)
      if (next) await navigate({ to: '/app/$programId', params: { programId: next.id } })
      else await navigate({ to: '/app' })
      await router.invalidate()
    } catch { toast.error('Eliminazione non riuscita.') }
    finally { setBusy(false) }
  }

  const running = ['running', 'waiting', 'stopping'].includes(python.status)
  const saveLabel = autosave.status === 'saved' ? 'Salvato' : autosave.status === 'error' ? 'Errore salvataggio' : 'Salvataggio…'
  const profileName = user.name?.trim() || user.email
  const profileInitials = profileName.slice(0, 2).toUpperCase()

  return <main className="ide-root bg-[var(--ide-canvas)]">
    <Group orientation="horizontal" groupRef={shellRef} className={`h-full ${animatedPanel === 'left' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-shell', JSON.stringify(layout)) }}>
      <Panel id="programs" panelRef={leftRef} defaultSize="16%" minSize={180} maxSize="35%" collapsible collapsedSize={0} onResize={(size) => setLeftOpen(size.inPixels > 0)} className="ide-panel flex min-w-0 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <span role="img" aria-label="Emipy" className="brand-symbol size-6" />
          <IconButton icon={PlusSignIcon} label="Nuovo programma" onClick={() => void create()} />
        </div>
        <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Programmi</div>
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Programmi" className="p-1.5">
            {programs.map((item) => <div key={item.id} className={`ide-program-row group flex items-center rounded ${item.id === program.id ? 'ide-program-row-active' : ''}`}>
              <button type="button" onClick={() => void openProgram(item.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px]"><Icon icon={ChangeScreenModeIcon} className="size-3.5 shrink-0" /><span className="truncate">{item.name}</span></button>
              {item.id === program.id && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="Azioni programma" className="mr-2"><Icon icon={MoreHorizontalIcon} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onSelect={() => { setNewName(program.name); setRenameOpen(true) }}><Icon icon={Edit02Icon} /> Rinomina</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Icon icon={Delete02Icon} /> Elimina</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}
            </div>)}
          </nav>
        </ScrollArea>
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-11 w-full justify-start gap-2.5 rounded-2xl bg-background/70 px-2 text-left hover:bg-background" aria-label={`Menu profilo di ${profileName}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-medium text-muted-foreground">{profileInitials}</span>
                <span className="min-w-0 flex-1 truncate">{profileName}</span>
                <Icon icon={Settings02Icon} className="size-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</p>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><Icon icon={resolvedTheme === 'dark' ? Sun03Icon : Moon02Icon} /> Tema {resolvedTheme === 'dark' ? 'chiaro' : 'scuro'}</DropdownMenuItem>
                {user.role?.split(',').includes('admin') && <DropdownMenuItem onSelect={() => void navigate({ to: '/admin' })}><Icon icon={UserGroupIcon} /> Utenti</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}><Icon icon={Logout01Icon} /> Esci</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Panel>
      <Separator className="ide-handle ide-side-handle w-px" />
      <Panel id="shell" minSize="45%" className="flex min-w-0 flex-col">
        <header className="ide-toolbar flex h-12 shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3">
          <IconButton icon={leftOpen ? LayoutLeftIcon : LayoutAlignLeftIcon} label={leftOpen ? 'Nascondi programmi' : 'Mostra programmi'} onClick={() => togglePanel('left')} />
          <div className="min-w-0 flex-1">
            <Button type="button" variant="ghost" size="sm" className="max-w-full font-medium" onClick={() => { setNewName(program.name); setRenameOpen(true) }}><span className="truncate">{program.name}</span></Button>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">{python.status === 'loading' ? 'Caricamento Python…' : python.status === 'error' ? 'Python non disponibile' : ''}</div>
          <Button type="button" size="sm" className="min-w-23" disabled={python.status === 'loading' || python.status === 'error' || python.status === 'stopping'} onClick={() => running ? python.stop() : python.run(autosave.code)}>
            <Icon icon={running ? StopIcon : PlayIcon} />{running ? 'STOP' : 'START'}
          </Button>
          <IconButton icon={outputOpen ? LayoutBottomIcon : LayoutAlignBottomIcon} label={outputOpen ? 'Nascondi console' : 'Mostra console'} onClick={() => togglePanel('output')} />
          <IconButton icon={rightOpen ? LayoutRightIcon : LayoutAlignRightIcon} label={rightOpen ? 'Nascondi file' : 'Mostra file'} onClick={() => togglePanel('right')} />
          <span className="sr-only" role="status" aria-live="polite">{saveLabel}</span>
        </header>
        <Group orientation="horizontal" groupRef={workspaceRef} className={`min-h-0 flex-1 ${animatedPanel === 'right' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-workspace', JSON.stringify(layout)) }}>
          <Panel id="workspace" minSize="35%" className="flex min-w-0 flex-col">
            <Group orientation="vertical" groupRef={verticalRef} className={`min-h-0 flex-1 ${animatedPanel === 'output' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-vertical', JSON.stringify(layout)) }}>
              <Panel id="editor" defaultSize="70%" minSize="25%" className="flex min-h-0 flex-col pb-1 pl-2 pr-2 pt-0">
                <section aria-label="Editor main.py" className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-[var(--monaco-bg)]">
                  <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3 text-[11px] text-muted-foreground"><Icon icon={File01Icon} className="size-3.5" /><span className="font-semibold text-foreground">main.py</span><span className="ml-auto">Python</span></div>
                  <div className="min-h-0 flex-1">{mounted && <Suspense fallback={<div className="p-5 text-sm text-muted-foreground">Caricamento editor…</div>}><CodeEditor value={autosave.code} onChange={autosave.update} dark={resolvedTheme === 'dark'} /></Suspense>}</div>
                </section>
              </Panel>
              <Separator className="ide-handle ide-output-handle h-1" />
              <Panel id="output" panelRef={outputRef} defaultSize="30%" minSize="12%" maxSize="70%" collapsible collapsedSize={0} onResize={(size) => setOutputOpen(size.inPixels > 0)} className="flex min-h-0 flex-col p-2 pt-1">
                <section aria-label="Output programma" className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-[var(--code-bg)]">
                  <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3"><Icon icon={TerminalIcon} className="size-3.5" /><span className="text-[11px] font-bold uppercase tracking-wider">Output</span><span className="ml-auto text-[10px] text-muted-foreground">{python.status === 'waiting' ? 'In attesa di input' : running ? 'In esecuzione' : ''}</span><Button variant="ghost" size="xs" onClick={python.clearOutput}>Pulisci</Button></div>
                  <ScrollArea className="min-h-0 flex-1 px-3 py-2"><div data-testid="output" className="output-scroll min-h-full">{python.output.length === 0 ? <span className="font-sans text-xs text-muted-foreground">Premi START per eseguire main.py.</span> : python.output.map((line, index) => <span key={index} className={line.kind === 'stderr' ? 'text-destructive' : line.kind === 'system' ? 'text-muted-foreground' : line.kind === 'input' ? 'text-primary' : ''}>{line.text}</span>)}<div ref={outputEnd} /></div></ScrollArea>
                  <form onSubmit={(event) => { event.preventDefault(); if (python.submitInput(input)) setInput('') }} className="flex shrink-0 gap-1.5 border-t border-border p-1.5"><Input aria-label="Input programma" placeholder={python.status === 'waiting' ? 'Scrivi input e premi Invio…' : 'Input disponibile quando richiesto'} disabled={python.status !== 'waiting'} value={input} onChange={(event) => setInput(event.target.value)} className="h-7 font-mono text-xs" /><Button size="sm" type="submit" disabled={python.status !== 'waiting'}>Invia</Button></form>
                </section>
              </Panel>
            </Group>
          </Panel>
          <Separator className="ide-handle ide-side-handle ide-files-handle w-px" />
          <Panel id="files" panelRef={rightRef} defaultSize="16%" minSize={145} maxSize="30%" collapsible collapsedSize={0} onResize={(size) => setRightOpen(size.inPixels > 0)} className="ide-files-panel min-w-0">
            <div className="flex h-8 items-center pr-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">File</div>
            <div className="pr-3 pb-1.5"><Input aria-label="Cerca file" placeholder="Cerca file" value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} className="h-7 bg-background text-xs" /></div>
            <div className="pr-1.5">{'main.py'.includes(fileSearch.trim().toLowerCase()) && <div className="ide-project-file flex items-center gap-2 rounded pr-2 py-1.5 text-[13px]"><Icon icon={File01Icon} className="size-3.5 shrink-0 text-ring" /><span>main.py</span></div>}</div>
            <p className="pr-3 pt-1.5 text-[11px] text-muted-foreground">Modificato {new Date(program.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </Panel>
        </Group>
      </Panel>
    </Group>

    <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent><DialogHeader><DialogTitle>Rinomina programma</DialogTitle><DialogDescription>Scegli un nome breve e riconoscibile.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void rename() }} className="flex flex-col gap-4"><Input autoFocus maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} aria-label="Nome programma" /><DialogFooter><Button type="submit" disabled={busy || !newName.trim()}>Salva</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare «{program.name}»?</AlertDialogTitle><AlertDialogDescription>Programma e codice verranno eliminati definitivamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void remove() }}>Elimina</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}
