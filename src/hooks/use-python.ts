import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, type WorkerToMain } from '@/lib/python-protocol'

export type OutputChunk = { kind: 'stdout' | 'stderr' | 'system' | 'input'; text: string }
type Status = 'loading' | 'ready' | 'running' | 'waiting' | 'stopping' | 'error'

export function usePython(enabled = true) {
  const worker = useRef<Worker | null>(null)
  const interrupt = useRef<Int32Array | null>(null)
  const inputState = useRef<Int32Array | null>(null)
  const inputBytes = useRef<Uint8Array | null>(null)
  const runId = useRef(0)
  const outputSize = useRef(0)
  const truncated = useRef(false)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    worker.current?.terminate()
    setStatus('loading')
    const next = new Worker(new URL('../workers/python.worker.ts', import.meta.url), { type: 'module' })
    worker.current = next
    next.onmessage = (event: MessageEvent<WorkerToMain>) => {
      const message = event.data
      if (message.type === 'ready') { setStatus('ready'); return }
      if (message.type === 'fatal') { setStatus('error'); append('system', `Python non disponibile: ${message.message}`); return }
      if (message.runId !== runId.current) return
      if (message.type === 'stdout' || message.type === 'stderr') append(message.type, message.text)
      if (message.type === 'stdin-request') setStatus('waiting')
      if (message.type === 'done' || message.type === 'stopped') {
        if (stopTimer.current) clearTimeout(stopTimer.current)
        stopTimer.current = null
        interrupt.current = null
        inputState.current = null
        inputBytes.current = null
        setStatus('ready')
        if (message.type === 'stopped') append('system', 'Esecuzione fermata.')
      }
    }
    next.onerror = () => { setStatus('error'); append('system', 'Errore del runtime Python.') }
  }, [append])

  useEffect(() => {
    if (!enabled) return
    createWorker()
    return () => { worker.current?.terminate(); if (stopTimer.current) clearTimeout(stopTimer.current) }
  }, [createWorker, enabled])

  const run = useCallback((code: string, files: { name: string; code: string }[] = []) => {
    if (!worker.current || status !== 'ready' || !crossOriginIsolated) {
      append('system', 'Python richiede connessione sicura e isolamento browser.')
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
    setStatus('running')
    worker.current.postMessage({ type: 'run', code, files, runId: runId.current, interruptBuffer, inputBuffer })
  }, [append, status])

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
    return true
  }, [append, status])

  const stop = useCallback(() => {
    if (!['running', 'waiting'].includes(status)) return
    setStatus('stopping')
    if (interrupt.current) { Atomics.store(interrupt.current, 0, 2); Atomics.notify(interrupt.current, 0) }
    if (inputState.current) Atomics.notify(inputState.current, 0)
    const stoppedRun = runId.current
    stopTimer.current = setTimeout(() => {
      if (runId.current !== stoppedRun) return
      runId.current += 1
      append('system', 'Esecuzione fermata. Riavvio Python…')
      createWorker()
    }, 250)
  }, [append, createWorker, status])

  return { status, output, run, stop, submitInput, clearOutput: () => setOutput([]) }
}
