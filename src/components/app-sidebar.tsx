import { useNavigate, useRouteContext } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, BookOpen02Icon, CodeIcon, LibraryIcon, LockIcon, Logout01Icon, Moon02Icon, PlusSignIcon, Sun03Icon, Tick02Icon, UserGroupIcon } from '@hugeicons/core-free-icons'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { createProgram } from '@/lib/programs.functions'

type LessonLink = { externalId: string; title: string; completed: boolean; unlocked: boolean }

export function AppSidebar({ active, course, lessons, currentLessonId, freePrograms = [] }: {
  active: 'courses' | 'playground' | 'library'
  course?: { externalId: string; title: string }
  lessons?: LessonLink[]
  currentLessonId?: string
  freePrograms?: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const { user } = useRouteContext({ from: '/app' })
  const { resolvedTheme, setTheme } = useTheme()
  const profileName = user.name?.trim() || user.email

  async function newPlayground() {
    try {
      const program = await createProgram({ data: {} })
      await navigate({ to: '/app/playground/$programId', params: { programId: program.id } })
    } catch { toast.error('Impossibile creare il programma.') }
  }

  const navClass = (selected: boolean) => `ide-program-row h-10 w-full justify-start gap-2.5 px-3 ${selected ? 'ide-program-row-active' : ''}`

  return <aside className="ide-panel flex h-full min-w-0 flex-col">
    <div className="flex h-12 shrink-0 items-center px-3"><span role="img" aria-label="Emipy" className="brand-symbol size-6" /></div>
    <div className="sidebar-crossfade min-h-0 flex-1 overflow-hidden">
      {course && lessons ? <div className="sidebar-view flex h-full flex-col px-2">
        <Button variant="ghost" className="ide-program-row h-10 justify-start gap-2 px-2" onClick={() => void navigate({ to: '/app/courses' })}><HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Tutti i corsi</Button>
        <div className="px-2 pb-2 pt-5"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Corso</p><p className="mt-1 truncate text-sm font-semibold">{course.title}</p></div>
        <nav aria-label="Lezioni" className="space-y-1 overflow-y-auto pb-4">
          {lessons.map((lesson, index) => <Button key={lesson.externalId} variant="ghost" disabled={!lesson.unlocked} title={!lesson.unlocked ? 'Completa prima la lezione precedente' : undefined} className={`ide-program-row h-auto min-h-10 w-full justify-start gap-2 px-2 py-2 text-left ${lesson.externalId === currentLessonId ? 'ide-program-row-active' : ''}`} onClick={() => void navigate({ to: '/app/courses/$courseId/$lessonId', params: { courseId: course.externalId, lessonId: lesson.externalId } })}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${lesson.completed ? 'border-transparent bg-[var(--brand-accent)] text-[#18181b]' : lesson.externalId === currentLessonId ? 'border-transparent bg-foreground text-background' : 'border-border text-muted-foreground'}`}>{lesson.completed ? <HugeiconsIcon icon={Tick02Icon} className="size-3.5" aria-hidden="true" /> : index + 1}</span><span className="truncate text-xs">{lesson.title}</span>{!lesson.unlocked && <HugeiconsIcon icon={LockIcon} className="ml-auto size-3 shrink-0" aria-hidden="true" />}
          </Button>)}
        </nav>
      </div> : <div className="sidebar-view flex h-full flex-col px-2">
        <nav aria-label="Navigazione principale" className="space-y-1">
          <Button variant="ghost" className={navClass(active === 'courses')} onClick={() => void navigate({ to: '/app/courses' })}><HugeiconsIcon icon={BookOpen02Icon} className="size-4" /> Corsi</Button>
          <Button variant="ghost" className={navClass(active === 'playground')} onClick={() => void newPlayground()}><HugeiconsIcon icon={CodeIcon} className="size-4" /> Playground <HugeiconsIcon icon={PlusSignIcon} className="ml-auto size-3.5" /></Button>
          <Button variant="ghost" className={navClass(active === 'library')} onClick={() => void navigate({ to: '/app/library' })}><HugeiconsIcon icon={LibraryIcon} className="size-4" /> Libreria</Button>
        </nav>
        {active === 'playground' && freePrograms.length > 0 && <div className="mt-6 min-h-0 flex-1"><p className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Programmi liberi</p><nav className="mt-2 space-y-1 overflow-y-auto">{freePrograms.map((program) => <Button key={program.id} variant="ghost" className="ide-program-row h-9 w-full justify-start truncate px-2 text-xs" onClick={() => void navigate({ to: '/app/playground/$programId', params: { programId: program.id } })}>{program.name}</Button>)}</nav></div>}
      </div>}
    </div>
    <div className="p-2">
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-10 w-full justify-start gap-2 px-2"><span className="flex size-6 items-center justify-center rounded-full border text-[10px]">{profileName.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-left text-sm">{profileName}</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-52"><p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</p><DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><HugeiconsIcon icon={resolvedTheme === 'dark' ? Sun03Icon : Moon02Icon} /> Tema {resolvedTheme === 'dark' ? 'chiaro' : 'scuro'}</DropdownMenuItem>
          {user.role?.split(',').includes('admin') && <DropdownMenuItem onSelect={() => void navigate({ to: '/admin' })}><HugeiconsIcon icon={UserGroupIcon} /> Utenti</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}><HugeiconsIcon icon={Logout01Icon} /> Esci</DropdownMenuItem>
        </DropdownMenuGroup></DropdownMenuContent>
      </DropdownMenu>
    </div>
  </aside>
}
