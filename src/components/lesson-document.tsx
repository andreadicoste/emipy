import ReactMarkdown from 'react-markdown'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import type { StudentLessonDTO } from '@/lib/curriculum-schema'

export function LessonDocument({ lesson, onStart, busyExercise }: { lesson: StudentLessonDTO; onStart: (exerciseId: string) => void; busyExercise?: string | null }) {
  return <article className="lesson-document mx-auto w-full max-w-3xl px-6 py-10 sm:px-10">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lezione {lesson.order}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
    <p className="mt-3 text-base text-muted-foreground">{lesson.description}</p>
    <div className="mt-10 space-y-7">{lesson.blocks.map((block, index) => {
      if (block.type === 'markdown') return <div key={index} className="lesson-markdown"><ReactMarkdown>{block.body}</ReactMarkdown></div>
      if (block.type === 'code') return <figure key={index} className="overflow-hidden rounded-lg border bg-[var(--code-bg)]"><div className="flex h-9 items-center border-b px-4 text-xs text-muted-foreground"><span>{block.filename ?? block.language}</span>{block.caption && <span className="ml-auto">{block.caption}</span>}</div><pre className="overflow-x-auto p-4 text-sm"><code>{block.code}</code></pre></figure>
      return <aside key={index} data-variant={block.variant} className="lesson-callout"><p className="text-sm font-semibold">{block.title ?? (block.variant === 'warning' ? 'Attenzione' : 'Da ricordare')}</p><div className="lesson-markdown mt-1 text-sm"><ReactMarkdown>{block.body}</ReactMarkdown></div></aside>
    })}</div>
    <section className="mt-14 border-t pt-8"><h2 className="text-xl font-semibold">Esercizi</h2><p className="mt-1 text-sm text-muted-foreground">Apri un workspace e prova subito quello che hai imparato.</p><div className="mt-5 space-y-3">{lesson.exercises.map((exercise, index) => <div key={exercise.externalId} className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">{index + 1}</div><div className="min-w-0 flex-1"><h3 className="font-semibold">{exercise.title}</h3><p className="mt-1 text-sm text-muted-foreground">{exercise.instructions}</p><div className="mt-2 flex flex-wrap gap-2">{exercise.learningObjectives.map((item) => <span key={item} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />{item}</span>)}</div></div><Button size="sm" disabled={!!busyExercise} onClick={() => onStart(exercise.externalId)}>Apri <HugeiconsIcon icon={ArrowRight01Icon} /></Button></div>)}</div></section>
  </article>
}
