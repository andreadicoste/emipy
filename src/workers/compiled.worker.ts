import { C_ASSET_BASE, executeCompiled, loadCToolchain, type CPhase } from '@/lib/c-runtime/compiler'
import type { CompiledLanguage } from '@/lib/languages'
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, type WorkerToMain } from '@/lib/runtime-protocol'

type Request = {
  type: 'run'; runId: number; code: string; files: { name: string; code: string }[]
  language?: CompiledLanguage
  inputBuffer?: SharedArrayBuffer; stdin?: string[]; evaluation?: boolean
}
const send = (message: WorkerToMain) => self.postMessage(message)
const toolchain = loadCToolchain(async (name) => {
  const response = await fetch(`${C_ASSET_BASE}${name}`)
  if (!response.ok) throw new Error(`Toolchain C/C++: ${name}, HTTP ${response.status}`)
  return response.arrayBuffer()
})
void toolchain.then(() => send({ type: 'ready' })).catch((error: unknown) => send({ type: 'fatal', message: String(error) }))

self.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data
  if (message.type !== 'run') return
  const { runId } = message
  const state: { phase: CPhase } = { phase: 'compiling' }
  let inputIndex = 0, inputExhausted = false, outputBytes = 0, truncated = false
  let stdout = '', stderr = '', transcript = ''
  const pendingOutput = { stdout: '', stderr: '' }
  const firstRuntimeLine = { stdout: true, stderr: true }
  let lastFlush = performance.now()
  const flush = () => {
    if (message.evaluation) return
    for (const kind of ['stdout', 'stderr'] as const) {
      if (pendingOutput[kind]) send({ type: kind, text: pendingOutput[kind], runId })
      pendingOutput[kind] = ''
    }
    lastFlush = performance.now()
  }
  let remainingInput = new Uint8Array()
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }
  const encoder = new TextEncoder()
  const inputState = message.inputBuffer ? new Int32Array(message.inputBuffer, 0, 2) : null
  const inputBytes = message.inputBuffer ? new Uint8Array(message.inputBuffer, 8, MAX_INPUT_BYTES) : null
  const append = (kind: 'stdout' | 'stderr', text: string) => {
    if (message.evaluation) {
      if (kind === 'stdout') stdout = (stdout + text).slice(0, 128 * 1024)
      else stderr = (stderr + text).slice(0, 128 * 1024)
      transcript = (transcript + text).slice(0, 256 * 1024)
    } else {
      pendingOutput[kind] += text
      // Send the first complete runtime line even if a synchronous WASM loop
      // follows it: timers cannot flush a worker while WASM is still running.
      const firstLine = state.phase === 'running' && firstRuntimeLine[kind] && text.includes('\n')
      if (firstLine) firstRuntimeLine[kind] = false
      // Bound message volume for tight printf loops so the UI can still STOP.
      if (firstLine || pendingOutput[kind].length >= 8192 || performance.now() - lastFlush >= 50) flush()
    }
  }
  const write = (fd: number, bytes: Uint8Array) => {
    const kind = fd === 2 ? 'stderr' : 'stdout'
    const permitted = Math.max(0, MAX_OUTPUT_BYTES - outputBytes)
    outputBytes += bytes.byteLength
    append(kind, decoders[kind].decode(bytes.subarray(0, permitted), { stream: true }))
    if (outputBytes > MAX_OUTPUT_BYTES && !truncated) {
      truncated = true
      append('stderr', '\nOutput troncato: limite 1 MiB.\n')
    }
  }
  const read = (length: number): Uint8Array => {
    if (!remainingInput.length) {
      if (message.evaluation) {
        if (inputIndex >= (message.stdin?.length ?? 0)) { inputExhausted = true; return new Uint8Array() }
        const value = `${message.stdin![inputIndex++]}\n`
        remainingInput = encoder.encode(value)
        transcript = (transcript + value).slice(0, 256 * 1024)
      } else {
        if (!inputState || !inputBytes) throw new Error('Buffer input non disponibile')
        Atomics.store(inputState, 0, 0)
        flush()
        send({ type: 'stdin-request', runId })
        while (Atomics.load(inputState, 0) === 0) Atomics.wait(inputState, 0, 0)
        // Copy shared bytes before decoding; append the terminal's newline.
        const count = Atomics.load(inputState, 1)
        remainingInput = new Uint8Array(count + 1)
        remainingInput.set(inputBytes.subarray(0, count))
        remainingInput[count] = 10
      }
    }
    const bytes = remainingInput.slice(0, length)
    remainingInput = remainingInput.slice(bytes.length)
    return bytes
  }
  let exitCode = 1
  try {
    exitCode = await executeCompiled(await toolchain, message.code, message.files, {
      write, read,
      phase: (next) => { state.phase = next; send({ type: 'phase', phase: next, runId }) },
    }, message.language ?? 'c')
    if (exitCode !== 0 && !message.evaluation) append('stderr', `\n${state.phase === 'running' ? 'Programma terminato' : 'Compilazione non riuscita'} (codice ${exitCode}).\n`)
  } catch (error) { append('stderr', `${String(error)}\n`) }
  append('stdout', decoders.stdout.decode())
  append('stderr', decoders.stderr.decode())
  flush()
  if (message.evaluation) self.postMessage({ type: 'result', runId, stdout, stderr, transcript, exitCode, compileFailed: state.phase !== 'running', timedOut: false, inputExhausted })
  else send({ type: 'done', runId, exitCode })
}
