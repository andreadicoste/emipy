import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, type WorkerToMain } from '@/lib/runtime-protocol'
import { languages, isCompiledLanguage, type Language } from '@/lib/languages'

export type OutputChunk = { kind: 'stdout' | 'stderr' | 'system' | 'input'; text: string }
type Status = 'loading' | 'ready' | 'compiling' | 'linking' | 'running' | 'waiting' | 'stopping' | 'error'

export function useRuntime(language: Language, enabled = true) {
  const worker = useRef<Worker | null>(null)
  const interrupt = useRef<Int32Array | null>(null)
  const inputState = useRef<Int32Array | null>(null)
  const inputBytes = useRef<Uint8Array | null>(null)
  const runId = useRef(0)
  const outputSize = useRef(0)
  const truncated = useRef(false)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [output, setOutput] = useState<OutputChunk[]>([])

  const append = useCallback((kind: OutputChunk['kind'], text: string) => {
    if (kind !== 'system') {
      outputSize.current += new TextEncoder().encode(text).byteLength
      if (outputSize.current > MAX_OUTPUT_BYTES) {
        if (!truncated.current) {
          truncated.current = true
          setOutput((lines) => [...lines, { kind: 'system', text: 'Output troncato: limite 1 MiB.' }])
        }
        return
      }
    }
    setOutput((lines) => [...lines, { kind, text }])
  }, [])

  const createWorker = useCallback(() => {
    if (deadline.current) clearTimeout(deadline.current)
    if (stopTimer.current) clearTimeout(stopTimer.current)
    worker.current?.terminate()
    setStatus('loading')
    const next = isCompiledLanguage(language)
      ? new Worker(new URL('../workers/compiled.worker.ts', import.meta.url), { type: 'module' })
      : language === 'javascript'
      ? new Worker(new URL('../workers/javascript.worker.ts', import.meta.url), { type: 'module' })
      : new Worker(new URL('../workers/python.worker.ts', import.meta.url), { type: 'module' })
    worker.current = next
    deadline.current = setTimeout(() => {
      next.terminate()
      setStatus('error')
      append('system', `Caricamento ${languages[language].label} non riuscito: limite 90 secondi. Riapri il programma per riprovare.`)
    }, 90_000)
    next.onmessage = (event: MessageEvent<WorkerToMain>) => {
      if (worker.current !== next) return
      const message = event.data
      if (message.type === 'ready') { if (deadline.current) clearTimeout(deadline.current); setStatus('ready'); return }
      if (message.type === 'fatal') { if (deadline.current) clearTimeout(deadline.current); setStatus('error'); append('system', `${languages[language].label} non disponibile: ${message.message}`); return }
      if (message.runId !== runId.current) return
      if (message.type === 'stdout' || message.type === 'stderr') append(message.type, message.text)
      if (message.type === 'phase') {
        setStatus(message.phase)
        if (message.phase === 'running') {
          if (deadline.current) clearTimeout(deadline.current)
          deadline.current = setTimeout(() => {
            runId.current += 1
            append('system', 'Esecuzione interrotta: limite 30 secondi.')
            createWorker()
          }, 30_000)
        }
      }
      if (message.type === 'stdin-request') { if (deadline.current) clearTimeout(deadline.current); setStatus('waiting') }
      if (message.type === 'done' || message.type === 'stopped') {
        if (deadline.current) clearTimeout(deadline.current)
        if (stopTimer.current) clearTimeout(stopTimer.current)
        stopTimer.current = null
        interrupt.current = null
        inputState.current = null
        inputBytes.current = null
        setStatus('ready')
        if (message.type === 'stopped') append('system', 'Esecuzione fermata.')
      }
    }
    next.onerror = () => { if (worker.current !== next) return; if (deadline.current) clearTimeout(deadline.current); setStatus('error'); append('system', `Errore del runtime ${languages[language].label}.`) }
  }, [append, language])

  useEffect(() => {
    if (!enabled) return
    createWorker()
    return () => { worker.current?.terminate(); if (stopTimer.current) clearTimeout(stopTimer.current); if (deadline.current) clearTimeout(deadline.current) }
  }, [createWorker, enabled])

  const run = useCallback((code: string, files: { name: string; code: string }[] = []) => {
    if (!worker.current || status !== 'ready' || !crossOriginIsolated) {
      append('system', `${languages[language].label} richiede connessione sicura e isolamento browser.`)
      return
    }
    runId.current += 1
    outputSize.current = 0
    truncated.current = false
    setOutput([])
    const interruptBuffer = new SharedArrayBuffer(4)
    const inputBuffer = new SharedArrayBuffer(8 + MAX_INPUT_BYTES)
    interrupt.current = new Int32Array(interruptBuffer)
    inputState.current = new Int32Array(inputBuffer, 0, 2)
    inputBytes.current = new Uint8Array(inputBuffer, 8, MAX_INPUT_BYTES)
    setStatus(isCompiledLanguage(language) ? 'compiling' : 'running')
    if (isCompiledLanguage(language)) deadline.current = setTimeout(() => {
      runId.current += 1
      append('system', 'Compilazione interrotta: limite 60 secondi.')
      createWorker()
    }, 60_000)
    worker.current.postMessage({ type: 'run', language, code, files, runId: runId.current, interruptBuffer, inputBuffer })
  }, [append, status, language, createWorker])

  const submitInput = useCallback((value: string) => {
    if (status !== 'waiting' || !inputState.current || !inputBytes.current) return false
    const bytes = new TextEncoder().encode(value)
    if (bytes.byteLength > MAX_INPUT_BYTES) { append('system', 'Input troppo lungo (massimo 64 KiB).'); return false }
    inputBytes.current.set(bytes)
    Atomics.store(inputState.current, 1, bytes.byteLength)
    Atomics.store(inputState.current, 0, 1)
    Atomics.notify(inputState.current, 0)
    append('input', `${value}\n`)
    setStatus('running')
    if (language !== 'python') deadline.current = setTimeout(() => {
      runId.current += 1
      append('system', 'Esecuzione interrotta: limite 30 secondi.')
      createWorker()
    }, 30_000)
    return true
  }, [append, status, language, createWorker])

  const stop = useCallback(() => {
    if (!['compiling', 'linking', 'running', 'waiting'].includes(status)) return
    if (language !== 'python') {
      runId.current += 1
      append('system', `Esecuzione fermata. Riavvio ${languages[language].label}…`)
      createWorker()
      return
    }
    setStatus('stopping')
    if (interrupt.current) { Atomics.store(interrupt.current, 0, 2); Atomics.notify(interrupt.current, 0) }
    if (inputState.current) Atomics.notify(inputState.current, 0)
    const stoppedRun = runId.current
    stopTimer.current = setTimeout(() => {
      if (runId.current !== stoppedRun) return
      runId.current += 1
      append('system', `Esecuzione fermata. Riavvio ${languages[language].label}…`)
      createWorker()
    }, 250)
  }, [append, createWorker, status, language])

  return { status, output, run, stop, submitInput, clearOutput: () => setOutput([]) }
}
