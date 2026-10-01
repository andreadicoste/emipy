import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { HugeiconsIcon } from '@hugeicons/react'
import { BorderAll02Icon, Delete02Icon, Edit02Icon, File01Icon, LayoutAlignBottomIcon, LayoutAlignLeftIcon, LayoutAlignRightIcon, LayoutBottomIcon, LayoutLeftIcon, LayoutRightIcon, Loading03Icon, MoreHorizontalIcon, PlayIcon, PlusSignIcon, SquareArrowUp02Icon, StopIcon, TerminalIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator as UiSeparator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createProgramFile, deleteProgram, renameProgram, type getProgram } from '@/lib/programs.functions'
import { beginExerciseGrading, failExerciseGrading, finishExerciseGrading, startExercise } from '@/lib/curriculum.functions'
import type { Course, StudentExerciseView, StudentLessonDTO } from '@/lib/curriculum-schema'
import type { ProgramSnapshot } from '@/lib/agent-contract'
import { MAIN_FILE_ID, useAutosave } from '@/hooks/use-autosave'
import { useLayoutPreferences } from '@/lib/layout-preferences'
import { panelDefaultSize } from '@/lib/layout-storage'
import { useEvaluationRunner } from '@/hooks/use-evaluation-runner'
import { useRuntime } from '@/hooks/use-runtime'
import { languages, languageSchema } from '@/lib/languages'
import { AppSidebar } from './app-sidebar'
import { TutorPanel } from './tutor-panel'
import { LessonDocument } from './lesson-document'

const CodeEditor = lazy(() => import('./code-editor').then((module) => ({ default: module.CodeEditor })))
const LESSON_FILE_ID = '__lesson__'
type Program = Awaited<ReturnType<typeof getProgram>>
type ProgramSummary = { id: string; name: string; exerciseId?: string | null }
type Learning = { course: Course; lesson: StudentLessonDTO; lessons: { externalId: string; title: string; completed: boolean; unlocked: boolean }[]; exercise?: StudentExerciseView }
type IconType = Parameters<typeof HugeiconsIcon>[0]['icon']

function Icon({ icon, className }: { icon: IconType; className?: string }) { return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} aria-hidden="true" /> }
function IconButton({ icon, label, onClick, className }: { icon: IconType; label: string; onClick: () => void; className?: string }) { return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className={className} aria-label={label} onClick={onClick}><Icon icon={icon} /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip> }
function FileMenu({ files, onNewFile, onOpenFile }: { files: { id: string; name: string }[]; onNewFile: () => void; onOpenFile: (id: string) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Apri file"><Icon icon={PlusSignIcon} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuGroup><DropdownMenuItem className="h-9 font-semibold" onSelect={onNewFile}><Icon icon={PlusSignIcon} /> Nuovo file</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup>{files.map((file) => <DropdownMenuItem key={file.id} onSelect={() => onOpenFile(file.id)}><Icon icon={File01Icon} /><span className="min-w-0 flex-1 truncate">{file.name}</span></DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
}

export function Ide({ program, programs, learning }: { program: Program | null; programs: ProgramSummary[]; learning?: Learning }) {
  const navigate = useNavigate()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { layouts, saveLayout } = useLayoutPreferences()
  const initialLayouts = useRef(layouts).current
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [openFileIds, setOpenFileIds] = useState<string[]>(program ? [MAIN_FILE_ID] : [])
  const [activeFileId, setActiveFileId] = useState(program ? MAIN_FILE_ID : LESSON_FILE_ID)
  const [newName, setNewName] = useState(program?.name ?? '')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startBusy, setStartBusy] = useState<string | null>(null)
  const [exerciseProgress, setExerciseProgress] = useState(learning?.exercise?.progress ?? null)
  const [leftOpen, setLeftOpen] = useState(initialLayouts.shell?.programs !== 0)
  const [rightOpen, setRightOpen] = useState(initialLayouts.workspace?.files !== 0)
  const [mobileView, setMobileView] = useState<'navigation' | 'content' | 'tutor'>('content')
  const [outputOpen, setOutputOpen] = useState(initialLayouts.vertical?.output !== 0)
  const [animatedPanel, setAnimatedPanel] = useState<'left' | 'right' | 'output' | null>(null)
  const language = languageSchema.parse(program?.language ?? 'python')
  const languageInfo = languages[language]
  const autosave = useAutosave(program?.id ?? null, program ? [{ id: MAIN_FILE_ID, name: languageInfo.mainFile, code: program.code }, ...program.files.map((file) => ({ id: file.id, name: file.name, code: file.code }))] : [])
  const runtime = useRuntime(language, !!program)
  const evaluation = useEvaluationRunner()
  const leftRef = usePanelRef(), rightRef = usePanelRef(), outputRef = usePanelRef()
  const shellRef = useGroupRef(), workspaceRef = useGroupRef(), verticalRef = useGroupRef()
  const layoutReady = useRef(false), outputEnd = useRef<HTMLDivElement | null>(null)
  const animationFrame = useRef<number | null>(null), animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const update = () => { setIsMobile(query.matches); setMobileView('content'); if (query.matches) setOutputOpen(true); setMounted(true) }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) { layoutReady.current = true; return }
    try {
      const shell = localStorage.getItem('emipy-layout-shell'), workspace = localStorage.getItem('emipy-layout-workspace'), vertical = localStorage.getItem('emipy-layout-vertical')
      if (shell && !layouts.shell) { const layout = JSON.parse(shell); shellRef.current?.setLayout(layout); saveLayout('shell', layout) }
      if (workspace && !layouts.workspace) { const layout = JSON.parse(workspace); workspaceRef.current?.setLayout(layout); saveLayout('workspace', layout) }
      if (program && vertical && !layouts.vertical) { const layout = JSON.parse(vertical); verticalRef.current?.setLayout(layout); saveLayout('vertical', layout) }
    } catch { /* old layout */ } finally { layoutReady.current = true }
  }, [shellRef, workspaceRef, verticalRef, layouts.shell, layouts.workspace, layouts.vertical, program, saveLayout])
  useEffect(() => {
    const viewport = outputEnd.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [runtime.output])
  useEffect(() => { if (autosave.status === 'error') toast.error('Salvataggio non riuscito. Modifica il codice per riprovare.') }, [autosave.status])
  useEffect(() => () => { if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current); if (animationTimeout.current !== null) clearTimeout(animationTimeout.current) }, [])

  function togglePanel(panel: 'left' | 'right' | 'output') {
    if (isMobile) {
      if (panel === 'output') setOutputOpen((open) => !open)
      else setMobileView((view) => view === (panel === 'left' ? 'navigation' : 'tutor') ? 'content' : panel === 'left' ? 'navigation' : 'tutor')
      return
    }
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current); if (animationTimeout.current !== null) clearTimeout(animationTimeout.current)
    setAnimatedPanel(panel)
    animationFrame.current = requestAnimationFrame(() => { const ref = panel === 'left' ? leftRef : panel === 'right' ? rightRef : outputRef; if (ref.current?.isCollapsed()) ref.current.expand(); else ref.current?.collapse(); animationFrame.current = null; animationTimeout.current = setTimeout(() => { setAnimatedPanel(null); animationTimeout.current = null }, 240) })
  }
  function openFile(id: string) { if (id !== LESSON_FILE_ID) setOpenFileIds((current) => current.includes(id) ? current : [...current, id]); setActiveFileId(id) }
  async function createFile() { if (!program) return; const entered = newFileName.trim(); const name = entered.includes('.') ? entered : `${entered}${languageInfo.extension}`; setFileBusy(true); try { const file = await createProgramFile({ data: { programId: program.id, name } }); autosave.add({ id: file.id, name: file.name, code: file.code }); openFile(file.id); setNewFileOpen(false); setNewFileName(''); toast.success('File creato.') } catch { toast.error(`Nome non valido o file già presente. Usa un nome come ${languageInfo.exampleFile}.`) } finally { setFileBusy(false) } }
  async function rename() { if (!program) return; setBusy(true); try { await renameProgram({ data: { id: program.id, name: newName } }); setRenameOpen(false); await router.invalidate(); toast.success('Programma rinominato.') } catch { toast.error('Nome non valido o rinomina non riuscita.') } finally { setBusy(false) } }
  async function remove() { if (!program) return; setBusy(true); try { await deleteProgram({ data: { id: program.id } }); setDeleteOpen(false); await navigate({ to: '/app/library' }); await router.invalidate() } catch { toast.error('Eliminazione non riuscita.') } finally { setBusy(false) } }
  async function startFromLesson(exerciseId: string) { if (!learning) return; setStartBusy(exerciseId); try { await autosave.flush(); const result = await startExercise({ data: { courseId: learning.course.externalId, lessonId: learning.lesson.externalId, exerciseId } }); await navigate({ to: '/app/courses/$courseId/$lessonId/$programId', params: { courseId: learning.course.externalId, lessonId: learning.lesson.externalId, programId: result.programId } }) } catch { toast.error('Impossibile aprire esercizio.') } finally { setStartBusy(null) } }
  function currentSnapshot(): ProgramSnapshot { return { language, mainCode: autosave.files[0]?.code ?? '', files: autosave.files.slice(1).map(({ name, code }) => ({ name, code })) } }
  async function submit() {
    if (!learning || !program) return
    setSubmitting(true)
    let submissionId: string | null = null
    try {
      await autosave.flush()
      const snapshot = currentSnapshot()
      const planned = await beginExerciseGrading({ data: { programId: program.id, idempotencyKey: crypto.randomUUID(), snapshot } })
      submissionId = planned.submissionId
      let result: Awaited<ReturnType<typeof evaluation.run>>
      try { result = await evaluation.run(snapshot, planned.stdin) }
      catch (error) { await failExerciseGrading({ data: { submissionId } }); throw error }
      const grade = await finishExerciseGrading({ data: { submissionId: planned.submissionId, evaluation: result } })
      setExerciseProgress({ attempts: (exerciseProgress?.attempts ?? 0) + 1, completed: grade.completed || !!exerciseProgress?.completed, feedback: grade.feedback, submissionStatus: grade.status })
      await router.invalidate()
      if (grade.completed) toast.success('Esercizio completato.')
      else toast.info(grade.feedback)
    } catch { await router.invalidate(); toast.error('Valutazione non riuscita. Riprova.') }
    finally { setSubmitting(false) }
  }

  const running = ['compiling', 'linking', 'running', 'waiting', 'stopping'].includes(runtime.status)
  const saveLabel = autosave.status === 'saved' ? 'Salvato' : autosave.status === 'error' ? 'Errore salvataggio' : 'Salvataggio…'
  const activeFile = autosave.files.find((file) => file.id === activeFileId) ?? autosave.files[0], mainFile = autosave.files[0]
  const freePrograms = programs.filter((item) => !item.exerciseId)
  const snapshot = currentSnapshot()
  const tutorContext = learning ? { programId: program?.id ?? null, courseId: learning.course.externalId, lessonId: learning.lesson.externalId, snapshot: program ? snapshot : null, lastExecution: program ? runtime.output.map((chunk) => `[${chunk.kind}] ${chunk.text}`).join('') : '' } : null
  const lessonForDisplay = learning ? { ...learning.lesson, exercises: learning.lesson.exercises.map((exercise) => learning.exercise && exercise.externalId === learning.exercise.externalId ? { ...exercise, progress: exerciseProgress } : exercise) } : null
  const showLesson = !!learning && !!lessonForDisplay && (activeFileId === LESSON_FILE_ID || !program)

  const toolbar = <header className="ide-toolbar flex h-12 shrink-0 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3"><IconButton icon={leftOpen ? LayoutLeftIcon : LayoutAlignLeftIcon} label={leftOpen ? 'Nascondi navigazione' : 'Mostra navigazione'} onClick={() => togglePanel('left')} className="mobile-panel-toggle" />
        {program && <><Button type="button" variant="ghost" size="sm" disabled={!!learning} className="hidden max-w-48 font-medium lg:inline-flex" onClick={() => { setNewName(program.name); setRenameOpen(true) }}><span className="truncate">{program.name}</span></Button><UiSeparator orientation="vertical" className="mx-1 hidden h-5! lg:block" /></>}
        <nav aria-label="File aperti" className="ide-file-tabs flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 lg:max-w-[min(40vw,640px)] lg:flex-[0_1_auto]">{learning && <Button type="button" aria-current={activeFileId === LESSON_FILE_ID ? 'true' : undefined} variant="ghost" size="sm" className={`ide-file-tab max-w-40 gap-1.5 ${activeFileId === LESSON_FILE_ID ? 'ide-file-tab-active' : ''}`} onClick={() => openFile(LESSON_FILE_ID)}><Icon icon={File01Icon} className="size-3.5" />lezione.md</Button>}{openFileIds.map((id) => { const file = autosave.files.find((item) => item.id === id); if (!file) return null; return <Button key={id} type="button" aria-current={id === activeFileId ? 'true' : undefined} variant="ghost" size="sm" className={`ide-file-tab max-w-40 gap-1.5 ${id === activeFileId ? 'ide-file-tab-active' : ''}`} onClick={() => openFile(id)}><Icon icon={File01Icon} className="size-3.5" /><span className="truncate">{file.name}</span></Button> })}{program && <div className="shrink-0 lg:hidden"><FileMenu files={autosave.files} onNewFile={() => setNewFileOpen(true)} onOpenFile={openFile} /></div>}</nav>
        {program && <div className="hidden lg:block"><FileMenu files={autosave.files} onNewFile={() => setNewFileOpen(true)} onOpenFile={openFile} /></div>}
        {program && !learning && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Azioni programma"><Icon icon={MoreHorizontalIcon} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onSelect={() => { setNewName(program.name); setRenameOpen(true) }}><Icon icon={Edit02Icon} /> Rinomina</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Icon icon={Delete02Icon} /> Elimina</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}
        <div className="hidden min-w-0 flex-1 lg:block" />{program && <div className="hidden text-xs text-muted-foreground lg:block">{runtime.status === 'loading' ? `Caricamento ${languageInfo.label}…` : runtime.status === 'error' ? `${languageInfo.label} non disponibile` : ''}</div>}
        {program && <><Button type="button" size="sm" className="size-8 px-0 lg:h-7 lg:w-auto lg:min-w-23 lg:px-2.5" aria-label={running ? 'Ferma programma' : 'Avvia programma'} disabled={runtime.status === 'loading' || runtime.status === 'error' || runtime.status === 'stopping'} onClick={() => running ? runtime.stop() : runtime.run(mainFile.code, autosave.files.filter((file) => file.id !== MAIN_FILE_ID).map(({ name, code }) => ({ name, code })))}><Icon icon={running ? StopIcon : PlayIcon} /><span className="hidden lg:inline">{running ? 'STOP' : 'START'}</span></Button>{learning && <Button type="button" size="sm" variant="outline" className="size-8 px-0 lg:h-7 lg:w-auto lg:px-2.5" aria-label={exerciseProgress?.attempts ? 'Riconsegna esercizio' : 'Consegna esercizio'} disabled={submitting} onClick={() => void submit()}><Icon icon={submitting ? Loading03Icon : SquareArrowUp02Icon} className={submitting ? 'animate-spin' : undefined} /><span className="hidden lg:inline">{exerciseProgress?.attempts ? 'Riconsegna' : 'Consegna'}</span></Button>}</>}
        {program && <IconButton icon={outputOpen ? LayoutBottomIcon : LayoutAlignBottomIcon} label={outputOpen ? 'Nascondi console' : 'Mostra console'} onClick={() => togglePanel('output')} />}<IconButton icon={rightOpen ? LayoutRightIcon : LayoutAlignRightIcon} label={rightOpen ? 'Nascondi Tutor' : 'Mostra Tutor'} onClick={() => togglePanel('right')} className="mobile-panel-toggle" /><span className="sr-only" role="status" aria-live="polite">{saveLabel}</span>
      </header>
  const editorContent = showLesson && lessonForDisplay ? <section className="ide-surface min-h-0 flex-1 overflow-y-auto rounded-md border bg-background"><LessonDocument lesson={lessonForDisplay} onStart={(id) => void startFromLesson(id)} busyExercise={startBusy} /></section> : program && activeFile ? <section aria-label={`Editor ${activeFile.name}`} className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-[var(--monaco-bg)]"><div className="flex h-8 shrink-0 items-center gap-1.5 border-b px-3 text-[11px] text-muted-foreground"><Icon icon={File01Icon} className="size-3.5" /><span className="font-semibold text-foreground">{activeFile.name}</span><span className="ml-auto">{languageInfo.label}</span></div><div className="min-h-0 flex-1">{mounted && <Suspense fallback={<div className="p-5 text-sm text-muted-foreground">Caricamento editor…</div>}><CodeEditor key={activeFile.id} path={`${program.id}/${activeFile.name}`} value={activeFile.code} onChange={(code) => autosave.update(activeFile.id, code)} language={language} dark={resolvedTheme === 'dark'} /></Suspense>}</div></section> : null
  const outputContent = <section aria-label="Output programma" className="ide-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-[var(--code-bg)]"><div className="flex h-8 shrink-0 items-center gap-1.5 border-b px-3"><Icon icon={TerminalIcon} className="size-3.5" /><span className="text-[11px] font-bold uppercase tracking-wider">Output</span><span className="ml-auto text-[10px] text-muted-foreground">{runtime.status === 'waiting' ? 'In attesa di input' : runtime.status === 'compiling' ? 'Compilazione…' : runtime.status === 'linking' ? 'Linking…' : running ? 'In esecuzione' : ''}</span><Button variant="ghost" size="xs" onClick={runtime.clearOutput}>Pulisci</Button></div><ScrollArea className="min-h-0 flex-1 px-3 py-2"><div data-testid="output" className="output-scroll min-h-full">{runtime.output.length === 0 ? <span className="font-sans text-xs text-muted-foreground">Premi START per eseguire {languageInfo.mainFile}.</span> : runtime.output.map((chunk, index) => <span key={index} className={chunk.kind === 'stderr' ? 'text-destructive' : chunk.kind === 'system' ? 'text-muted-foreground' : chunk.kind === 'input' ? 'text-primary' : ''}>{chunk.text}</span>)}<div ref={outputEnd} /></div></ScrollArea><form onSubmit={(event) => { event.preventDefault(); if (runtime.submitInput(input)) setInput('') }} className="flex shrink-0 gap-1.5 border-t p-1.5"><Input aria-label="Input programma" placeholder={runtime.status === 'waiting' ? 'Scrivi input e premi Invio…' : 'Input disponibile quando richiesto'} disabled={runtime.status !== 'waiting'} value={input} onChange={(event) => setInput(event.target.value)} className="h-7 font-mono text-xs" /><Button size="sm" type="submit" disabled={runtime.status !== 'waiting'}>Invia</Button></form></section>

  return <main className="ide-root bg-[var(--ide-canvas)]" data-layout-ready={mounted}>{isMobile ? <div className="ide-mobile-layout" data-mobile-view={mobileView}>
    <section className="ide-mobile-screen ide-mobile-navigation" aria-label="Navigazione" onClickCapture={(event) => { if ((event.target as HTMLElement).closest('nav button')) setMobileView('content') }}>
      <Button type="button" variant="ghost" size="icon-sm" className="mobile-side-dismiss" aria-label="Torna al contenuto" onClick={() => setMobileView('content')}><Icon icon={BorderAll02Icon} /></Button>
      <AppSidebar active={learning ? 'courses' : 'playground'} course={learning?.course} lessons={learning?.lessons} currentLessonId={learning?.lesson.externalId} freePrograms={freePrograms} />
    </section>
    <section className="ide-mobile-screen ide-mobile-content" aria-label="Contenuto">
      {toolbar}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`flex min-h-0 flex-col pb-1 pl-2 pr-2 ${program && outputOpen ? 'flex-[7]' : 'flex-1'}`}>{editorContent}</div>
        {program && outputOpen && <div className="flex min-h-0 flex-[3] flex-col p-2 pt-1">{outputContent}</div>}
      </div>
    </section>
    <section className="ide-mobile-screen ide-mobile-tutor" aria-label="Tutor">
      <header className="ide-toolbar flex h-12 shrink-0 items-center gap-2 px-3"><Button type="button" variant="ghost" size="icon-sm" className="mobile-panel-toggle" aria-label="Torna al contenuto" onClick={() => setMobileView('content')}><Icon icon={BorderAll02Icon} /></Button><span className="text-sm font-semibold">Tutor</span></header>
      <div className="min-h-0 flex-1"><TutorPanel context={tutorContext} runCurrentProgram={learning && program ? (stdin) => evaluation.run(currentSnapshot(), stdin) : undefined} /></div>
    </section>
  </div> : <Group orientation="horizontal" groupRef={shellRef} defaultLayout={initialLayouts.shell} className={`ide-desktop-layout h-full ${animatedPanel === 'left' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current && !window.matchMedia('(max-width: 1023px)').matches) saveLayout('shell', layout) }}>
    <Panel id="programs" panelRef={leftRef} defaultSize={panelDefaultSize(initialLayouts.shell, 'programs', 16)} minSize={180} maxSize="35%" collapsible collapsedSize={0} onResize={(size) => setLeftOpen(size.inPixels > 0)}><AppSidebar active={learning ? 'courses' : 'playground'} course={learning?.course} lessons={learning?.lessons} currentLessonId={learning?.lesson.externalId} freePrograms={freePrograms} /></Panel>
    <Separator className="ide-handle ide-side-handle w-px" />
    <Panel id="shell" defaultSize={panelDefaultSize(initialLayouts.shell, 'shell', 84)} minSize="45%" className="flex min-w-0 flex-col">
      {toolbar}
      <Group orientation="horizontal" groupRef={workspaceRef} defaultLayout={initialLayouts.workspace} className={`min-h-0 flex-1 ${animatedPanel === 'right' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (layoutReady.current && !window.matchMedia('(max-width: 1023px)').matches) saveLayout('workspace', layout) }}><Panel id="workspace" defaultSize={panelDefaultSize(initialLayouts.workspace, 'workspace', 82)} minSize="35%" className="flex min-w-0 flex-col"><Group orientation="vertical" groupRef={verticalRef} defaultLayout={program ? initialLayouts.vertical : undefined} className={`min-h-0 flex-1 ${animatedPanel === 'output' ? 'ide-toggle-motion' : ''}`} onLayoutChanged={(layout) => { if (program && layoutReady.current && !window.matchMedia('(max-width: 1023px)').matches) saveLayout('vertical', layout) }}>
        <Panel id="editor" defaultSize={program ? panelDefaultSize(initialLayouts.vertical, 'editor', 70) : '100%'} minSize="25%" className="flex min-h-0 flex-col pb-1 pl-2 pr-2">{editorContent}</Panel>
        {program && <><Separator className="ide-handle ide-output-handle h-1" /><Panel id="output" panelRef={outputRef} defaultSize={panelDefaultSize(initialLayouts.vertical, 'output', 30)} minSize="12%" maxSize="70%" collapsible collapsedSize={0} onResize={(size) => setOutputOpen(size.inPixels > 0)} className="flex min-h-0 flex-col p-2 pt-1">{outputContent}</Panel></>}
      </Group></Panel><Separator className="ide-handle ide-side-handle ide-files-handle w-px" /><Panel id="files" panelRef={rightRef} defaultSize={panelDefaultSize(initialLayouts.workspace, 'files', 18)} minSize={220} maxSize="40%" collapsible collapsedSize={0} onResize={(size) => setRightOpen(size.inPixels > 0)}><TutorPanel context={tutorContext} runCurrentProgram={learning && program ? (stdin) => evaluation.run(currentSnapshot(), stdin) : undefined} /></Panel></Group>
    </Panel>
  </Group>}
  <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent><DialogHeader><DialogTitle>Rinomina programma</DialogTitle><DialogDescription>Scegli un nome breve e riconoscibile.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void rename() }} className="flex flex-col gap-4"><Input autoFocus maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} aria-label="Nome programma" /><DialogFooter><Button type="submit" disabled={busy || !newName.trim()}>Salva</Button></DialogFooter></form></DialogContent></Dialog>
  <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}><DialogContent><DialogHeader><DialogTitle>Nuovo file {languageInfo.label}</DialogTitle><DialogDescription>{language === 'typescript' ? 'Puoi aggiungere moduli .ts e importarli da main.ts con import da ./nome o ./nome.ts.' : language === 'javascript' ? 'Puoi aggiungere moduli .js e importarli da main.js con import da ./nome.js.' : language === 'cpp' ? 'Puoi aggiungere sorgenti .cpp, .cc, .cxx o .c e header .h o .hpp. I sorgenti vengono compilati insieme a main.cpp.' : language === 'c' ? 'Puoi aggiungere sorgenti .c e header .h. I sorgenti vengono compilati insieme a main.c.' : 'Il file sarà disponibile nel programma e importabile da main.py.'}</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void createFile() }} className="flex flex-col gap-4"><Input autoFocus maxLength={78} value={newFileName} onChange={(event) => setNewFileName(event.target.value)} aria-label="Nome file" placeholder={languageInfo.exampleFile} /><DialogFooter><Button type="submit" disabled={fileBusy || !newFileName.trim()}>Crea file</Button></DialogFooter></form></DialogContent></Dialog>
  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare «{program?.name ?? ''}»?</AlertDialogTitle><AlertDialogDescription>Programma e codice verranno eliminati definitivamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void remove() }}>Elimina</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>
}
