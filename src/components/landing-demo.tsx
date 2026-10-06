import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon, PlayIcon, StopIcon, TerminalIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDemoRuntime } from '@/hooks/use-demo-runtime'
import { cn } from 'cn'

const CodeEditor = lazy(() => import('./code-editor').then((module) => ({ default: module.CodeEditor })))
const INITIAL_CODE = `// Una piccola idea. Un primo esperimento.
const nome = input("Come ti chiami? ");
console.log("Ciao, " + nome + "! Benvenuto in Emipy.");

const idee = ["scrivi", "prova", "scopri"];
for (const idea of idee) {
    console.log("→ " + idea);
}

// Ora tocca a te: cambia qualcosa e premi START.
`

export default function LandingDemo() {
  const [code, setCode] = useState(INITIAL_CODE)
  const [input, setInput] = useState('')
  const { resolvedTheme } = useTheme()
  const runtime = useDemoRuntime()
  const consoleRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const running = runtime.status === 'running' || runtime.status === 'waiting'
  const label = { loading: 'Caricamento QuickJS…', ready: 'Pronto', running: 'In esecuzione', waiting: 'In attesa di input', error: 'Runtime non disponibile' }[runtime.status]
  useEffect(() => { const view = consoleRef.current; if (view) view.scrollTop = view.scrollHeight }, [runtime.output])
  useEffect(() => { if (runtime.status === 'waiting') inputRef.current?.focus() }, [runtime.status])
  return <div className="landing-live-demo">
    <header className="landing-demo-toolbar ide-toolbar">
      <span className="flex items-center gap-2 text-sm font-semibold"><HugeiconsIcon icon={File01Icon} className="size-4" aria-hidden="true" />Il tuo esperimento</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={running} onClick={() => { setCode(INITIAL_CODE); setInput(''); runtime.clearOutput() }}>Reset</Button>
        {runtime.status === 'error' ? <Button size="sm" onClick={runtime.retry}>Riprova</Button> : <Button size="sm" disabled={runtime.status === 'loading'} onClick={() => { setInput(''); if (running) runtime.stop(); else runtime.run(code) }}><HugeiconsIcon icon={running ? StopIcon : PlayIcon} aria-hidden="true" />{running ? 'STOP' : 'START'}</Button>}
      </div>
    </header>
    <section aria-label="Editor JavaScript" className="landing-editor ide-surface">
      <div className="landing-panel-heading"><span>main.js</span><span className="text-muted-foreground">JavaScript</span></div>
      <div className="min-h-0 flex-1"><Suspense fallback={<div className="p-5 text-sm text-muted-foreground">Caricamento editor…</div>}><CodeEditor path="emipy-demo/main.js" language="javascript" value={code} onChange={setCode} dark={resolvedTheme === 'dark'} /></Suspense></div>
    </section>
    <section aria-label="Console del programma" className="landing-console ide-surface">
      <div className="landing-panel-heading"><span className="flex items-center gap-2"><HugeiconsIcon icon={TerminalIcon} className="size-3.5" aria-hidden="true" />Output</span><span role="status" className="ml-auto text-muted-foreground">{label}</span><Button size="xs" variant="ghost" onClick={runtime.clearOutput}>Pulisci</Button></div>
      <div ref={consoleRef} className="output-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2" tabIndex={0} aria-label="Output della console">
        {runtime.output.length === 0 ? <span className="font-sans text-xs text-muted-foreground">Premi START per eseguire main.js.</span> : runtime.output.map((chunk, index) => <span key={index} className={cn(chunk.kind === 'stderr' && 'text-destructive', chunk.kind === 'system' && 'text-muted-foreground', chunk.kind === 'input' && 'text-primary')}>{chunk.text}</span>)}
      </div>
      <form className="flex items-center gap-2 border-t p-2" onSubmit={(event) => { event.preventDefault(); if (runtime.submitInput(input)) setInput('') }}>
        <label htmlFor="demo-input" className="sr-only">Input del programma</label><Input ref={inputRef} id="demo-input" value={input} onChange={(event) => setInput(event.target.value)} disabled={runtime.status !== 'waiting'} placeholder={runtime.status === 'waiting' ? 'Scrivi qui e premi Invio…' : 'Il programma può chiederti un input'} className="h-9 font-mono text-xs" /><Button type="submit" size="sm" disabled={runtime.status !== 'waiting'}>Invia</Button>
      </form>
    </section>
  </div>
}
