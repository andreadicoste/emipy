import { useCallback, useEffect, useRef } from 'react'
import type { EvaluationResult, GradingEvaluation, ProgramSnapshot } from '@/lib/agent-contract'

type RunEvaluation = {
  (snapshot: ProgramSnapshot, stdin?: string[]): Promise<EvaluationResult>
  (snapshot: ProgramSnapshot, stdin: string[][]): Promise<GradingEvaluation>
}
type Task = { worker: Worker; timer: ReturnType<typeof setTimeout>; cancel: () => void }

export function useEvaluationRunner() {
  const tasks = useRef(new Set<Task>())
  const disposed = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    disposed.current = false
    return () => { disposed.current = true; for (const task of tasks.current) task.cancel(); tasks.current.clear() }
  }, [])

  const runOne = useCallback((snapshot: ProgramSnapshot, stdin: string[] = []): Promise<EvaluationResult> => {
    if (disposed.current) return Promise.reject(new Error('Workspace chiuso'))
    // Independent workers prevent globals and files from leaking between tests.
    const worker = snapshot.language === 'c'
      ? new Worker(new URL('../workers/c.worker.ts', import.meta.url), { type: 'module' })
      : new Worker(new URL('../workers/evaluation.worker.ts', import.meta.url), { type: 'module' })
    return new Promise((resolve, reject) => {
      const finish = (result?: EvaluationResult, error?: Error) => {
        clearTimeout(task.timer)
        worker.terminate()
        tasks.current.delete(task)
        if (error) reject(error)
        else resolve(result!)
      }
      const task: Task = {
        worker,
        timer: setTimeout(() => finish(undefined, new Error('Caricamento runtime: limite 90 secondi')), 90_000),
        cancel: () => finish(undefined, new Error('Workspace chiuso')),
      }
      tasks.current.add(task)
      const arm = (milliseconds: number, message: string) => {
        clearTimeout(task.timer)
        task.timer = setTimeout(() => finish({ stdin, stdout: '', stderr: message, transcript: '', timedOut: true, inputExhausted: false }), milliseconds)
      }
      worker.onerror = () => finish(undefined, new Error('Errore del runtime di valutazione'))
      worker.onmessage = (event: MessageEvent<{ type: string; phase?: string; message?: string } & Partial<EvaluationResult>>) => {
        const message = event.data
        if (message.type === 'fatal') { finish(undefined, new Error(message.message ?? 'Runtime non disponibile')); return }
        if (message.type === 'ready') {
          arm(snapshot.language === 'c' ? 60_000 : 10_000, snapshot.language === 'c' ? 'Compilazione interrotta: limite 60 secondi.' : 'Esecuzione interrotta: limite 10 secondi.')
          worker.postMessage({ type: 'run', runId: 1, code: snapshot.mainCode, files: snapshot.files, stdin, evaluation: true })
        }
        if (message.type === 'phase' && message.phase === 'running') arm(10_000, 'Esecuzione interrotta: limite 10 secondi.')
        if (message.type === 'result') finish({
          stdin, stdout: message.stdout ?? '', stderr: message.stderr ?? '', transcript: message.transcript ?? '',
          timedOut: message.timedOut ?? false, inputExhausted: message.inputExhausted ?? false,
          ...(message.exitCode !== undefined ? { exitCode: message.exitCode, compileFailed: message.compileFailed } : {}),
        })
      }
    })
  }, [])

  const run = useCallback((snapshot: ProgramSnapshot, stdin: string[] | string[][] = []) => {
    const request = queue.current.then(async () => {
      if (!stdin.length || typeof stdin[0] === 'string') return runOne(snapshot, stdin as string[])
      const runs: EvaluationResult[] = []
      for (const values of stdin as string[][]) runs.push(await runOne(snapshot, values))
      return { runs }
    })
    queue.current = request.catch(() => {})
    return request
  }, [runOne]) as RunEvaluation
  return { run }
}
