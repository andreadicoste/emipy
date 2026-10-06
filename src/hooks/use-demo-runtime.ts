import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_INPUT_BYTES, type WorkerToMain } from '@/lib/runtime-protocol'

type Status = 'loading' | 'ready' | 'running' | 'waiting' | 'error'
type Chunk = { kind: 'stdout' | 'stderr' | 'system' | 'input'; text: string }
const OUTPUT_LIMIT = 64 * 1024

// This entry point references only QuickJS; the public demo never loads other runtimes.
export function useDemoRuntime() {
  const worker = useRef<Worker | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runId = useRef(0)
  const size = useRef(0)
  const inputBuffer = useRef<SharedArrayBuffer | null>(null)
  const busy = useRef(false)
  const [status, setStatus] = useState<Status>('loading')
  const [output, setOutput] = useState<Chunk[]>([])
  const append = useCallback((kind: Chunk['kind'], text: string) => setOutput((previous) => {
    const last = previous.at(-1)
    return last?.kind === kind ? [...previous.slice(0, -1), { kind, text: last.text + text }] : [...previous, { kind, text }]
  }), [])
  const clearTimer = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null }, [])

  const createWorker = useCallback(() => {
    clearTimer()
    worker.current?.terminate()
    worker.current = null
    inputBuffer.current = null
    busy.current = false
    if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      setStatus('error')
      append('system', 'Il playground richiede HTTPS (o localhost) e gli header di isolamento del browser.\n')
      return
    }
    setStatus('loading')
    let next: Worker
    try { next = new Worker(new URL('../workers/javascript.worker.ts', import.meta.url), { type: 'module' }) }
    catch { setStatus('error'); append('system', 'Impossibile avviare QuickJS in questo browser.\n'); return }
    worker.current = next
    const fail = (message: string) => {
      clearTimer(); next.terminate(); worker.current = null; busy.current = false; inputBuffer.current = null
      setStatus('error'); append('system', message + '\n')
    }
    timer.current = setTimeout(() => fail('Caricamento scaduto. Premi Riprova.'), 30_000)
    next.onerror = () => { if (worker.current === next) fail('Errore del runtime. Premi Riprova.') }
    next.onmessage = ({ data }: MessageEvent<WorkerToMain>) => {
      if (worker.current !== next) return
      if (data.type === 'ready') { clearTimer(); setStatus('ready'); return }
      if (data.type === 'fatal') { fail(data.message); return }
      if (data.runId !== runId.current) return
      if (data.type === 'stdout' || data.type === 'stderr') {
        size.current += new TextEncoder().encode(data.text).byteLength
        if (size.current > OUTPUT_LIMIT) { fail('Esecuzione interrotta: limite di output raggiunto (64 KiB).'); return }
        append(data.type, data.text)
      }
      if (data.type === 'stdin-request') { clearTimer(); setStatus('waiting') }
      if (data.type === 'done' || data.type === 'stopped') {
        clearTimer(); busy.current = false; inputBuffer.current = null; setStatus('ready')
      }
    }
  }, [append, clearTimer])

  useEffect(() => { createWorker(); return () => { worker.current?.terminate(); clearTimer() } }, [createWorker, clearTimer])
  const armDeadline = () => {
    clearTimer()
    timer.current = setTimeout(() => {
      runId.current += 1; append('system', 'Esecuzione interrotta: limite 10 secondi.\n'); createWorker()
    }, 10_000)
  }
  const run = (code: string) => {
    if (status !== 'ready' || !worker.current || busy.current) return
    busy.current = true; runId.current += 1; size.current = 0; setOutput([])
    inputBuffer.current = new SharedArrayBuffer(8 + MAX_INPUT_BYTES)
    setStatus('running'); armDeadline()
    worker.current.postMessage({ type: 'run', language: 'javascript', runId: runId.current, code, files: [], inputBuffer: inputBuffer.current })
  }
  const stop = () => { runId.current += 1; append('system', 'Esecuzione fermata.\n'); createWorker() }
  const submitInput = (value: string) => {
    if (status !== 'waiting' || !inputBuffer.current) return false
    const bytes = new TextEncoder().encode(value)
    if (bytes.byteLength > MAX_INPUT_BYTES) { append('system', 'Input troppo lungo (massimo 64 KiB).\n'); return false }
    const state = new Int32Array(inputBuffer.current, 0, 2)
    new Uint8Array(inputBuffer.current, 8).set(bytes)
    Atomics.store(state, 1, bytes.byteLength); Atomics.store(state, 0, 1); Atomics.notify(state, 0)
    append('input', value + '\n'); setStatus('running'); armDeadline(); return true
  }
  return { status, output, run, stop, submitInput, retry: createWorker, clearOutput: () => setOutput([]) }
}
