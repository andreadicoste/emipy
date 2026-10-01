export const MAX_INPUT_BYTES = 64 * 1024
export const MAX_OUTPUT_BYTES = 1024 * 1024

export type MainToWorker =
  | { type: 'run'; code: string; files: { name: string; code: string }[]; runId: number; interruptBuffer: SharedArrayBuffer; inputBuffer: SharedArrayBuffer }

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'stdout' | 'stderr'; text: string; runId: number }
  | { type: 'stdin-request'; runId: number }
  | { type: 'phase'; phase: 'compiling' | 'linking' | 'running'; runId: number }
  | { type: 'done'; runId: number; exitCode?: number }
  | { type: 'stopped'; runId: number }
  | { type: 'fatal'; message: string; runId?: number }
