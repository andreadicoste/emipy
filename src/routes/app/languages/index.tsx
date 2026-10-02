import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, CodeIcon } from '@hugeicons/core-free-icons'
import { LearningShell } from '@/components/learning-shell'
import { listLanguages } from '@/lib/curriculum.functions'

export const Route = createFileRoute('/app/languages/')({ loader: () => listLanguages(), component: Languages })

const descriptions = {
  javascript: 'Impara JavaScript con funzioni, oggetti, array e moduli per i tuoi programmi.',
  python: 'Parti dalle basi e impara a costruire programmi, lavorare con i dati e realizzare piccoli progetti.',
  c: 'Esplora la programmazione in C: tipi, funzioni, memoria e programmi compilati.',
  cpp: 'Impara C++, dalla libreria standard a classi, oggetti e programmi compilati.',
} as const

function Languages() {
  const languages = Route.useLoaderData()
  const navigate = useNavigate()
  return <LearningShell active="courses"><section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
    <div className="flex items-end justify-between gap-5"><div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Il tuo percorso</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Linguaggi</h1>
      <p className="mt-2 text-sm text-muted-foreground">Scegli un linguaggio, poi il corso da seguire.</p>
    </div><HugeiconsIcon icon={CodeIcon} className="size-8 text-muted-foreground" aria-hidden="true" /></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{languages.map((item) => <button
      key={item.language}
      type="button"
      className="course-card group rounded-xl border bg-card p-6 text-left"
      onClick={() => void navigate({ to: '/app/languages/$language', params: { language: item.language } })}
    >
      <div className="flex items-start justify-between"><span className="flex size-12 items-center justify-center rounded-xl bg-accent font-mono text-xl font-semibold" aria-hidden="true">{item.language === 'python' ? 'Py' : item.language === 'javascript' ? 'JS' : item.label}</span><HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>
      <h2 className="mt-7 text-lg font-semibold">{item.label}</h2>
      <p className="mt-2 min-h-15 text-sm leading-5 text-muted-foreground">{descriptions[item.language]}</p>
      <div className="-mx-6 mt-5 flex items-center justify-between border-t px-6 pt-4 text-xs text-muted-foreground">
        <span>{item.courseCount ? `${item.courseCount} ${item.courseCount === 1 ? 'corso' : 'corsi'}` : 'Corsi in arrivo'}</span>
        {item.courseCount > 0 && <span>{item.completedCount}/{item.courseCount} completati</span>}
      </div>
    </button>)}</div>
  </section></LearningShell>
}
