import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, BookOpen02Icon } from '@hugeicons/core-free-icons'
import { LearningShell } from '@/components/learning-shell'
import { listCourses } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/courses/')({ loader: () => listCourses(), component: Courses })

function Courses() {
  const courses = Route.useLoaderData()
  const navigate = useNavigate()
  return <LearningShell active="courses"><section className="mx-auto max-w-6xl px-6 py-10 sm:px-10"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Impara Python</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Corsi</h1><p className="mt-2 text-sm text-muted-foreground">Scegli un percorso e impara facendo.</p></div><HugeiconsIcon icon={BookOpen02Icon} className="size-8 text-muted-foreground" /></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <button key={course.externalId} type="button" className="course-card group rounded-xl border bg-card p-6 text-left" onClick={() => void navigate({ to: '/app/courses/$courseId', params: { courseId: course.externalId } })}><div className="flex items-start justify-between"><span className="flex size-10 items-center justify-center rounded-lg bg-accent"><HugeiconsIcon icon={BookOpen02Icon} className="size-5" /></span><HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><h2 className="mt-7 text-lg font-semibold">{course.title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{course.description}</p><div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"><span>{course.lessonCount} {course.lessonCount === 1 ? 'lezione' : 'lezioni'}</span><span>{course.visitedCount}/{course.lessonCount} visitate</span></div></button>)}</div>
  </section></LearningShell>
}
