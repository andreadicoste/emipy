import type { QuickJSWASMModule } from 'quickjs-emscripten-core'

export type JavaScriptHost = {
  write: (kind: 'stdout' | 'stderr', text: string) => void
  read: () => string | null
  timeoutMs?: number
  extensionlessImports?: boolean
}

// Only source strings and console/input primitives cross the WASM boundary.
// A new QuickJS runtime isolates globals and module state on each execution.
export function executeJavaScript(engine: QuickJSWASMModule, code: string, files: { name: string; code: string }[], host: JavaScriptHost) {
  const runtime = engine.newRuntime()
  runtime.setMemoryLimit(64 * 1024 * 1024)
  runtime.setMaxStackSize(1024 * 1024)
  let deadline = performance.now() + (host.timeoutMs ?? 30_000)
  let timedOut = false
  runtime.setInterruptHandler(() => {
    timedOut = performance.now() > deadline
    return timedOut
  })
  const sources = new Map([['main.js', code], ...files.map((file) => [file.name, file.code] as const)])
  runtime.setModuleLoader((name) => {
    const source = sources.get(name)
    if (source === undefined) throw new Error(`Modulo locale non trovato: ${name}`)
    return source
  }, (_base, name) => {
    if (host.extensionlessImports && /^\.\/[A-Za-z_][A-Za-z0-9_]*$/.test(name)) name += '.js'
    if (!/^\.\/[A-Za-z_][A-Za-z0-9_]*\.js$/.test(name)) throw new Error('Import consentiti soltanto da file locali ./nome.js')
    return name.slice(2)
  })
  const context = runtime.newContext()
  const write = context.newFunction('__emipy_write', (kind, text) => {
    host.write(context.getString(kind) === 'stderr' ? 'stderr' : 'stdout', context.getString(text))
  })
  const read = context.newFunction('__emipy_read', () => {
    const started = performance.now()
    const value = host.read()
    deadline += performance.now() - started
    return value === null ? context.null : context.newString(value)
  })
  context.setProp(context.global, '__emipy_write', write)
  context.setProp(context.global, '__emipy_read', read)
  write.dispose(); read.dispose()
  const report = (error: Parameters<typeof context.dump>[0]) => {
    const value: unknown = context.dump(error)
    const detail = value !== null && typeof value === 'object'
      ? value as { name?: string; message?: string; stack?: string }
      : { message: String(value) }
    host.write('stderr', `${detail.name ?? 'Error'}: ${detail.message ?? String(detail)}${detail.stack ? `\n${detail.stack}` : ''}\n`)
  }
  try {
    const setup = context.evalCode(String.raw`(() => {
      const write = globalThis.__emipy_write, read = globalThis.__emipy_read;
      delete globalThis.__emipy_write; delete globalThis.__emipy_read;
      const format = value => {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.stack || String(value);
        if (value !== null && typeof value === 'object') { try { return JSON.stringify(value); } catch {} }
        return String(value);
      };
      const log = kind => (...args) => write(kind, args.map(format).join(' ') + '\n');
      globalThis.console = { log: log('stdout'), info: log('stdout'), debug: log('stdout'), warn: log('stderr'), error: log('stderr') };
      globalThis.print = console.log;
      globalThis.input = globalThis.prompt = (message = '') => { if (message) write('stdout', String(message)); return read(); };
    })()`, '__emipy_console.js')
    if (setup.error) { report(setup.error); setup.dispose(); return { exitCode: 1, timedOut } }
    setup.dispose()
    const result = context.evalCode(code, 'main.js', { type: 'module' })
    if (result.error) { report(result.error); result.dispose(); return { exitCode: 1, timedOut } }
    try {
      while (runtime.hasPendingJob()) {
        const jobs = runtime.executePendingJobs(1)
        if (jobs.error) { report(jobs.error); jobs.dispose(); return { exitCode: 1, timedOut } }
        jobs.dispose()
        if (performance.now() > deadline) { timedOut = true; host.write('stderr', 'Esecuzione interrotta: tempo esaurito.\n'); return { exitCode: 1, timedOut } }
      }
      const state = context.getPromiseState(result.value)
      if (state.type === 'rejected') {
        report(state.error); state.error.dispose()
        return { exitCode: 1, timedOut }
      }
      if (state.type === 'fulfilled' && !state.notAPromise) state.value.dispose()
      if (state.type === 'pending') {
        host.write('stderr', 'Il modulo è in attesa di una Promise che non può risolversi.\n')
        return { exitCode: 1, timedOut }
      }
      return { exitCode: 0, timedOut }
    } finally { result.dispose() }
  } finally { context.dispose(); runtime.dispose() }
}
