import { useCallback, useEffect, useRef } from 'react'
import type { EvaluationResult, GradingEvaluation, ProgramSnapshot } from '@/lib/agent-contract'

type Pending = { resolve: (value: EvaluationResult) => void; timer: ReturnType<typeof setTimeout>; stdin: string[] }
type RunEvaluation = {
  (snapshot: ProgramSnapshot, stdin?: string[]): Promise<EvaluationResult>
  (snapshot: ProgramSnapshot, stdin: string[][]): Promise<GradingEvaluation>
}

export function useEvaluationRunner() {
  const worker = useRef<Worker | null>(null)
  const ready = useRef<Promise<void> | null>(null)
  const markReady = useRef<(() => void) | null>(null)
  const pending = useRef(new Map<number, Pending>())
  const runId = useRef(0)

  const createWorker = useCallback(() => {
    worker.current?.terminate()
    ready.current = new Promise((resolve) => { markReady.current = resolve })
    const next = new Worker(new URL('../workers/evaluation.worker.ts', import.meta.url), { type: 'module' })
    worker.current = next
    next.onmessage = (event: MessageEvent<{ type: string; runId?: number } & Partial<EvaluationResult>>) => {
      if (event.data.type === 'ready') { markReady.current?.(); return }
      if (event.data.type !== 'result' || event.data.runId === undefined) return
      const task = pending.current.get(event.data.runId)
      if (!task) return
      clearTimeout(task.timer)
      pending.current.delete(event.data.runId)
      task.resolve({ stdin: task.stdin, stdout: event.data.stdout ?? '', stderr: event.data.stderr ?? '', transcript: event.data.transcript ?? '', timedOut: false, inputExhausted: event.data.inputExhausted ?? false })
    }
  }, [])

  useEffect(() => () => { worker.current?.terminate(); for (const task of pending.current.values()) clearTimeout(task.timer); pending.current.clear() }, [])

  const runOne = useCallback(async (snapshot: ProgramSnapshot, stdin: string[] = []) => {
    if (!worker.current) createWorker()
    await ready.current
    const id = ++runId.current
    return new Promise<EvaluationResult>((resolve) => {
      const timer = setTimeout(() => {
        pending.current.delete(id)
        resolve({ stdin, stdout: '', stderr: 'Esecuzione interrotta: limite 10 secondi.', transcript: '', timedOut: true, inputExhausted: false })
        createWorker()
      }, 10_000)
      pending.current.set(id, { resolve, timer, stdin })
      worker.current?.postMessage({ type: 'run', runId: id, code: snapshot.mainCode, files: snapshot.files, stdin })
    })
  }, [createWorker])

  const run = useCallback(async (snapshot: ProgramSnapshot, stdin: string[] | string[][] = []) => {
    if (!stdin.length || typeof stdin[0] === 'string') return runOne(snapshot, stdin as string[])
    const runs: EvaluationResult[] = []
    for (const values of stdin as string[][]) runs.push(await runOne(snapshot, values))
    return { runs }
  }, [runOne]) as RunEvaluation

  return { run }
}
