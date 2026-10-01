import variant from '@jitl/quickjs-wasmfile-release-sync'
import wasmLocation from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core'
import { executeJavaScript } from '@/lib/javascript-runtime/engine'
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, type WorkerToMain } from '@/lib/runtime-protocol'

type Request = { type: 'run'; runId: number; code: string; files: { name: string; code: string }[]; inputBuffer?: SharedArrayBuffer; evaluation?: boolean; stdin?: string[] }
const send = (message: WorkerToMain) => self.postMessage(message)
const engine = newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmLocation }))
void engine.then(() => send({ type: 'ready' })).catch((error: unknown) => send({ type: 'fatal', message: String(error) }))
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  if (data.type !== 'run') return
  const { runId } = data
  let stdout = '', stderr = '', transcript = '', inputIndex = 0, inputExhausted = false
  let outputBytes = 0, truncated = false, lastFlush = performance.now()
  const pending = { stdout: '', stderr: '' }
  const firstLine = { stdout: true, stderr: true }
  const encoder = new TextEncoder(), decoder = new TextDecoder()
  const flush = () => {
    if (data.evaluation) return
    for (const kind of ['stdout', 'stderr'] as const) { if (pending[kind]) send({ type: kind, runId, text: pending[kind] }); pending[kind] = '' }
    lastFlush = performance.now()
  }
  const write = (kind: 'stdout' | 'stderr', text: string) => {
    const bytes = encoder.encode(text)
    const remaining = Math.max(0, MAX_OUTPUT_BYTES - outputBytes)
    outputBytes += bytes.length
    text = decoder.decode(bytes.subarray(0, remaining))
    if (outputBytes > MAX_OUTPUT_BYTES && !truncated) { truncated = true; text += '\nOutput troncato: limite 1 MiB.\n' }
    if (data.evaluation) {
      if (kind === 'stdout') stdout = (stdout + text).slice(0, 128 * 1024)
      else stderr = (stderr + text).slice(0, 128 * 1024)
      transcript = (transcript + text).slice(0, 256 * 1024)
    } else {
      pending[kind] += text
      const immediate = firstLine[kind] && text.includes('\n')
      if (immediate) firstLine[kind] = false
      if (immediate || pending[kind].length >= 8192 || performance.now() - lastFlush >= 50) flush()
    }
  }
  const read = () => {
    if (data.evaluation) {
      if (inputIndex >= (data.stdin?.length ?? 0)) { inputExhausted = true; return null }
      const value = data.stdin![inputIndex++]
      transcript = (transcript + value + '\n').slice(0, 256 * 1024)
      return value
    }
    if (!data.inputBuffer) throw new Error('Buffer input non disponibile')
    const state = new Int32Array(data.inputBuffer, 0, 2)
    const bytes = new Uint8Array(data.inputBuffer, 8, MAX_INPUT_BYTES)
    Atomics.store(state, 0, 0)
    flush(); send({ type: 'stdin-request', runId })
    while (Atomics.load(state, 0) === 0) Atomics.wait(state, 0, 0)
    return decoder.decode(bytes.slice(0, Atomics.load(state, 1)))
  }
  send({ type: 'phase', phase: 'running', runId })
  let result = { exitCode: 1, timedOut: false }
  try { result = executeJavaScript(await engine, data.code, data.files, { write, read, timeoutMs: data.evaluation ? 10_000 : 30_000 }) }
  catch (error) { write('stderr', `${String(error)}\n`) }
  flush()
  if (data.evaluation) self.postMessage({ type: 'result', runId, stdout, stderr, transcript, ...result, compileFailed: false, inputExhausted })
  else send({ type: 'done', runId, exitCode: result.exitCode })
}
