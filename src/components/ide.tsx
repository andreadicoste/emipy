import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Delete02Icon, Edit02Icon, File01Icon, Files01Icon, Logout01Icon,
  Menu01Icon, Moon02Icon, MoreHorizontalIcon, PanelLeftIcon, PanelRightIcon,
  PlayIcon, PlusSignIcon, StopIcon, Sun03Icon, TerminalIcon, UserGroupIcon,
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

  return <main className="ide-root bg-[var(--ide-canvas)]">
    <Group orientation="horizontal" groupRef={shellRef} className="h-full" onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-shell', JSON.stringify(layout)) }}>
      <Panel id="programs" panelRef={leftRef} defaultSize="18%" minSize={190} maxSize="35%" collapsible collapsedSize={0} className="ide-panel flex min-w-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <img src="/assets/emipy-symbol.svg" alt="Emipy" className="brand-symbol size-7" />
          <IconButton icon={PlusSignIcon} label="Nuovo programma" onClick={() => void create()} />
        </div>
        <div className="px-4 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Programmi</div>
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Programmi" className="p-2">
            {programs.map((item) => <div key={item.id} className={`ide-program-row group flex items-center rounded-md ${item.id === program.id ? 'ide-program-row-active' : ''}`}>
              <button type="button" onClick={() => void openProgram(item.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm"><Icon icon={Files01Icon} className="size-4 shrink-0" /><span className="truncate">{item.name}</span></button>
              {item.id === program.id && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="Azioni programma" className="mr-2"><Icon icon={MoreHorizontalIcon} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onSelect={() => { setNewName(program.name); setRenameOpen(true) }}><Icon icon={Edit02Icon} /> Rinomina</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Icon icon={Delete02Icon} /> Elimina</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}
            </div>)}
          </nav>
        </ScrollArea>
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{programs.length} {programs.length === 1 ? 'programma' : 'programmi'}</div>
      </Panel>
      <Separator className="ide-handle ide-side-handle w-px" />
      <Panel id="shell" minSize="45%" className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <IconButton icon={PanelLeftIcon} label="Mostra o nascondi programmi" onClick={() => leftRef.current?.isCollapsed() ? leftRef.current.expand() : leftRef.current?.collapse()} />
          <div className="min-w-0 flex-1">
            <button type="button" className="flex max-w-full items-center gap-2 text-left text-sm font-semibold hover:text-muted-foreground" onClick={() => { setNewName(program.name); setRenameOpen(true) }}>
              <span className="truncate">{program.name}</span><Icon icon={Edit02Icon} className="size-3.5 shrink-0" />
            </button>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">{python.status === 'loading' ? 'Caricamento Python…' : python.status === 'error' ? 'Python non disponibile' : ''}</div>
          <Button type="button" size="sm" className="min-w-23" disabled={python.status === 'loading' || python.status === 'error' || python.status === 'stopping'} onClick={() => running ? python.stop() : python.run(autosave.code)}>
            <Icon icon={running ? StopIcon : PlayIcon} />{running ? 'STOP' : 'START'}
          </Button>
          <IconButton icon={PanelRightIcon} label="Mostra o nascondi file" onClick={() => rightRef.current?.isCollapsed() ? rightRef.current.expand() : rightRef.current?.collapse()} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Menu profilo"><Icon icon={Menu01Icon} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50">
              <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</p>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><Icon icon={resolvedTheme === 'dark' ? Sun03Icon : Moon02Icon} /> Tema {resolvedTheme === 'dark' ? 'chiaro' : 'scuro'}</DropdownMenuItem>
                {user.role?.split(',').includes('admin') && <DropdownMenuItem onSelect={() => void navigate({ to: '/admin' })}><Icon icon={UserGroupIcon} /> Utenti</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}><Icon icon={Logout01Icon} /> Esci</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="sr-only" role="status" aria-live="polite">{saveLabel}</span>
        </header>
        <Group orientation="horizontal" groupRef={workspaceRef} className="min-h-0 flex-1" onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-workspace', JSON.stringify(layout)) }}>
          <Panel id="workspace" minSize="35%" className="flex min-w-0 flex-col">
            <Group orientation="vertical" groupRef={verticalRef} className="min-h-0 flex-1" onLayoutChanged={(layout) => { if (layoutReady.current) localStorage.setItem('emipy-layout-vertical', JSON.stringify(layout)) }}>
              <Panel id="editor" defaultSize="70%" minSize="25%" className="flex min-h-0 flex-col p-2 pb-1">
                <section aria-label="Editor main.py" className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-[var(--monaco-bg)]">
                  <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4 text-xs text-muted-foreground"><Icon icon={File01Icon} className="size-4" /><span className="font-semibold text-foreground">main.py</span><span className="ml-auto">Python</span></div>
                  <div className="min-h-0 flex-1">{mounted && <Suspense fallback={<div className="p-5 text-sm text-muted-foreground">Caricamento editor…</div>}><CodeEditor value={autosave.code} onChange={autosave.update} dark={resolvedTheme === 'dark'} /></Suspense>}</div>
                </section>
              </Panel>
              <Separator className="ide-handle ide-output-handle h-1" />
              <Panel id="output" panelRef={outputRef} defaultSize="30%" minSize="12%" maxSize="70%" collapsible collapsedSize={0} className="flex min-h-0 flex-col p-2 pt-1">
                <section aria-label="Output programma" className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-[var(--code-bg)]">
                  <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4"><Icon icon={TerminalIcon} className="size-4" /><span className="text-xs font-bold uppercase tracking-wider">Output</span><span className="ml-auto text-[11px] text-muted-foreground">{python.status === 'waiting' ? 'In attesa di input' : running ? 'In esecuzione' : ''}</span><Button variant="ghost" size="xs" onClick={python.clearOutput}>Pulisci</Button></div>
                  <ScrollArea className="min-h-0 flex-1 px-4 py-3"><div data-testid="output" className="output-scroll min-h-full">{python.output.length === 0 ? <span className="font-sans text-xs text-muted-foreground">Premi START per eseguire main.py.</span> : python.output.map((line, index) => <span key={index} className={line.kind === 'stderr' ? 'text-destructive' : line.kind === 'system' ? 'text-muted-foreground' : line.kind === 'input' ? 'text-primary' : ''}>{line.text}</span>)}<div ref={outputEnd} /></div></ScrollArea>
                  <form onSubmit={(event) => { event.preventDefault(); if (python.submitInput(input)) setInput('') }} className="flex shrink-0 gap-2 border-t border-border p-2"><Input aria-label="Input programma" placeholder={python.status === 'waiting' ? 'Scrivi input e premi Invio…' : 'Input disponibile quando richiesto'} disabled={python.status !== 'waiting'} value={input} onChange={(event) => setInput(event.target.value)} className="h-8 font-mono text-xs" /><Button size="sm" type="submit" disabled={python.status !== 'waiting'}>Invia</Button></form>
                </section>
              </Panel>
            </Group>
          </Panel>
          <Separator className="ide-handle ide-side-handle ide-files-handle w-px" />
          <Panel id="files" panelRef={rightRef} defaultSize="18%" minSize={160} maxSize="30%" collapsible collapsedSize={0} className="min-w-0">
            <div className="flex h-12 items-center pr-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">File</div>
            <div className="pb-2 pr-3"><Input aria-label="Cerca file" placeholder="Cerca file" value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} className="h-8 bg-background text-sm" /></div>
            <div className="pr-2">{'main.py'.includes(fileSearch.trim().toLowerCase()) && <div className="ide-project-file flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm"><Icon icon={File01Icon} className="size-4 shrink-0 text-ring" /><span>main.py</span></div>}</div>
            <p className="pr-5 pt-2 text-xs text-muted-foreground">Modificato {new Date(program.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </Panel>
        </Group>
      </Panel>
    </Group>

    <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent><DialogHeader><DialogTitle>Rinomina programma</DialogTitle><DialogDescription>Scegli un nome breve e riconoscibile.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void rename() }} className="flex flex-col gap-4"><Input autoFocus maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} aria-label="Nome programma" /><DialogFooter><Button type="submit" disabled={busy || !newName.trim()}>Salva</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare «{program.name}»?</AlertDialogTitle><AlertDialogDescription>Programma e codice verranno eliminati definitivamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void remove() }}>Elimina</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}
