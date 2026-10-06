import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, PlayIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const Demo = lazy(() => import('@/components/landing-demo'))

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Emipy — impara a programmare nel browser' }, { name: 'description', content: 'Corsi, esercizi e un editor per imparare Python, C, C++, JavaScript e TypeScript nel browser. Prova la demo JavaScript di Emipy senza creare un account.' }] }),
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
      <Link to="/" aria-label="Emipy, home" className="flex items-center gap-2.5"><span className="brand-symbol size-8" aria-hidden="true" /><img src="/assets/emipy-wordmark.svg" alt="Emipy" className="brand-wordmark h-8 w-auto" /></Link>
      <nav aria-label="Navigazione principale" className="flex items-center gap-3">
        <a href="https://github.com/andreadicoste/emipy" className="landing-text-link">GitHub<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" /></a>
        <Button asChild variant="outline" size="sm"><Link to="/login">Accedi</Link></Button>
      </nav>
    </header>
    <main>
      <section className="landing-hero">
        <Badge variant="outline">Impara a programmare nel browser</Badge>
        <h1>Dal primo esercizio<br />al tuo primo <span className="landing-start-word">programma<span className="landing-dot">.</span></span></h1>
        <p>Emipy riunisce corsi, esercizi e un editor in un unico spazio.<br className="hidden sm:block" /> Impara Python, C, C++, JavaScript e TypeScript scrivendo ed eseguendo codice.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><a href="#demo"><HugeiconsIcon icon={PlayIcon} aria-hidden="true" />Prova la demo JavaScript</a></Button>
          <Button asChild variant="ghost" size="lg"><a href="https://github.com/andreadicoste/emipy">Esplora il progetto<HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" /></a></Button>
        </div>
        <span className="landing-hero-note">La demo è qui sotto. Nessuna installazione, nessun account.</span>
      </section>
      <section id="demo" aria-labelledby="demo-title" className="landing-demo-section">
        <div className="landing-demo-heading"><div><p className="landing-eyebrow">PROVA EMIPY</p><h2 id="demo-title">Scrivi JavaScript. Guarda il risultato.</h2></div><Badge variant="secondary">JavaScript · QuickJS</Badge></div>
        <div className="landing-demo-frame">
          <aside className="landing-empty-sidebar" aria-hidden="true"><span className="brand-symbol size-6" /></aside>
          <div className="landing-demo-center">
            {active ? <DemoBoundary><Suspense fallback={<div className="landing-demo-placeholder" role="status">Caricamento del playground…</div>}><Demo /></Suspense></DemoBoundary> : <div className="landing-demo-placeholder">
              <div className="landing-preview-code" aria-hidden="true"><span>// Il tuo primo programma JavaScript.</span><br /><strong>console</strong>.log(<em>"Ciao, mondo!"</em>);</div>
              <Button size="lg" onClick={() => setActive(true)}><HugeiconsIcon icon={PlayIcon} aria-hidden="true" />Apri l’editor JavaScript</Button>
              <p>Modifica l’esempio, eseguilo e leggi l’output nella console.</p>
            </div>}
          </div>
          <aside className="landing-empty-sidebar landing-empty-sidebar-right" aria-hidden="true" />
        </div>
        <p className="landing-demo-caption">Premi START per eseguire il codice e STOP per interromperlo.<br />La demo usa QuickJS nel tuo browser. Il codice resta nella scheda e non viene salvato.</p>
      </section>
      <section className="landing-details" aria-label="Scopri Emipy">
        <article><span className="landing-detail-number">01 / IMPARA</span><h2>Un percorso per ogni linguaggio.</h2><p>Nell’app completa, lezioni ed esercizi ti accompagnano dalle basi ai concetti più avanzati. I progressi vengono salvati nel tuo account.</p></article>
        <article><span className="landing-detail-number">02 / METTI IN PRATICA</span><h2>Il codice gira nel tuo browser.</h2><p>Scrivi nell’editor Monaco, esegui il programma e interagisci con la console. Anche Python, C e C++ funzionano senza installare un ambiente sul tuo computer.</p></article>
        <article><span className="landing-detail-number">03 / CAPISCI</span><h2>Un aiuto quando ti blocchi.</h2><p>Nell’app completa, il tutor AI ti aiuta a capire gli errori e ragionare sugli esercizi. Questa demo ti lascia provare direttamente editor e console.</p></article>
      </section>
    </main>
    <footer className="landing-footer"><div className="flex items-center gap-3"><span className="brand-symbol size-6" aria-hidden="true" /><span>Emipy · Open source. Puoi ospitarlo sul tuo server.</span></div><a className="landing-text-link" href="https://github.com/andreadicoste/emipy">Codice sorgente<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden="true" /></a></footer>
  </div>
}
