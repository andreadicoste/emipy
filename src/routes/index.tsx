import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const Demo = lazy(() => import('@/components/landing-demo'))

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Emipy — un piccolo spazio per grandi idee' }, { name: 'description', content: 'Impara a programmare, un esperimento alla volta. Prova Emipy con un editor JavaScript e una console direttamente nel browser.' }] }),
  component: Landing,
})

class DemoBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="landing-demo-placeholder"><p>La demo non è stata caricata.</p><Button onClick={() => window.location.reload()}>Ricarica la pagina</Button></div> : this.props.children
  }
}

function Landing() {
  const [active, setActive] = useState(false)
  return <div className="landing-page">
    <a href="#demo" className="sr-only focus:not-sr-only">Vai alla demo</a>
    <header className="landing-nav">
      <Link to="/" aria-label="Emipy, home"><img src="/assets/emipy-wordmark.svg" alt="Emipy" className="brand-wordmark h-8 w-auto" /></Link>
      <nav aria-label="Navigazione principale" className="flex items-center gap-3">
        <a href="https://github.com/andreadicoste/emipy" className="landing-text-link">GitHub ↗</a>
        <Button asChild variant="outline" size="sm"><Link to="/login">Accedi</Link></Button>
      </nav>
    </header>
    <main>
      <section className="landing-hero">
        <Badge variant="outline">Un esperimento alla volta.</Badge>
        <h1>Le idee iniziano piccole.<br />Poi premi <span className="landing-start-word">START<span className="landing-dot">.</span></span></h1>
        <p>Uno spazio tranquillo per imparare a programmare.<br className="hidden sm:block" /> Scrivi, prova, sbaglia. E scopri cosa succede.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><a href="#demo"><HugeiconsIcon icon={PlayIcon} aria-hidden="true" />Prova qui sotto</a></Button>
          <Button asChild variant="ghost" size="lg"><a href="https://github.com/andreadicoste/emipy">Esplora il progetto<HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" /></a></Button>
        </div>
        <span className="landing-hero-note">Solo tu, il codice e un po’ di curiosità.</span>
      </section>
      <section id="demo" aria-labelledby="demo-title" className="landing-demo-section">
        <div className="landing-demo-heading"><div><p className="landing-eyebrow">IL TUO PRIMO ESPERIMENTO</p><h2 id="demo-title">Un piccolo playground. Tutto tuo.</h2></div><Badge variant="secondary">JavaScript · QuickJS</Badge></div>
        <div className="landing-demo-frame">
          <aside className="landing-empty-sidebar" aria-hidden="true"><span className="brand-symbol size-6" /></aside>
          <div className="landing-demo-center">
            {active ? <DemoBoundary><Suspense fallback={<div className="landing-demo-placeholder" role="status">Caricamento del playground…</div>}><Demo /></Suspense></DemoBoundary> : <div className="landing-demo-placeholder">
              <div className="landing-preview-code" aria-hidden="true"><span>// Ogni idea merita un tentativo.</span><br /><strong>console</strong>.log(<em>"Ciao, mondo!"</em>);</div>
              <Button size="lg" onClick={() => setActive(true)}><HugeiconsIcon icon={PlayIcon} aria-hidden="true" />Apri il playground</Button>
              <p>L’editor si carica quando vuoi provarlo.</p>
            </div>}
          </div>
          <aside className="landing-empty-sidebar landing-empty-sidebar-right" aria-hidden="true" />
        </div>
        <p className="landing-demo-caption">Modifica il codice e premi START. Nessun account necessario.<br />Questa demo esegue JavaScript nel tuo browser; il codice resta in questa scheda.</p>
      </section>
      <section className="landing-details" aria-label="Scopri Emipy">
        <article><span className="landing-detail-number">01 / SCRIVI</span><h2>Spazio alle tue idee.</h2><p>Un vero editor, una console e il piacere di vedere il tuo codice prendere vita.</p></article>
        <article><span className="landing-detail-number">02 / ESPLORA</span><h2>Piccoli passi, nuove possibilità.</h2><p>Nell’app completa trovi percorsi ed esercizi di Python, C, C++, JavaScript e TypeScript.</p></article>
        <article><span className="landing-detail-number">03 / COSTRUISCI</span><h2>La curiosità è un buon inizio.</h2><p>Emipy è un progetto aperto. Guarda come funziona, proponi un’idea o costruisci qualcosa di tuo.</p></article>
      </section>
    </main>
    <footer className="landing-footer"><span>Emipy <span className="landing-dot">✳</span> Fatto per imparare.</span><a className="landing-text-link" href="https://github.com/andreadicoste/emipy">Codice sorgente ↗</a></footer>
  </div>
}
