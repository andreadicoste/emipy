import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { BookOpen02Icon, CodeIcon } from '@hugeicons/core-free-icons'
import { LearningShell } from '@/components/learning-shell'
import { listLibrary } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/library')({ loader: () => listLibrary(), component: Library })

function Library() {
  const programs = Route.useLoaderData()
  const navigate = useNavigate()
  function open(program: typeof programs[number]) {
    if (program.exerciseId && program.courseId && program.lessonId) void navigate({ to: '/app/courses/$courseId/$lessonId/$programId', params: { courseId: program.courseId, lessonId: program.lessonId, programId: program.id } })
    else void navigate({ to: '/app/playground/$programId', params: { programId: program.id } })
  }
  return <LearningShell active="library"><section className="mx-auto max-w-6xl px-6 py-10 sm:px-10"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">I tuoi lavori</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Libreria</h1><p className="mt-2 text-sm text-muted-foreground">Programmi liberi ed esercizi, tutti nello stesso posto.</p>
    {programs.length === 0 ? <div className="mt-10 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nessun programma ancora.</div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{programs.map((program) => <button key={program.id} type="button" className="course-card rounded-xl border bg-card p-5 text-left" onClick={() => open(program)}><span className="flex size-9 items-center justify-center rounded-lg bg-accent"><HugeiconsIcon icon={program.exerciseId ? BookOpen02Icon : CodeIcon} className="size-4" /></span><h2 className="mt-5 truncate font-semibold">{program.name}</h2><p className="mt-1 text-xs text-muted-foreground">{program.exerciseId ? `${program.courseTitle} · ${program.lessonTitle}` : 'Playground'}</p><p className="mt-5 border-t pt-3 text-[11px] text-muted-foreground">Aggiornato {new Date(program.updatedAt).toLocaleDateString('it-IT')}</p></button>)}</div>}
  </section></LearningShell>
}
