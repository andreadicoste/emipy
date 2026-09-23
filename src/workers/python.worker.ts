import type { MainToWorker, WorkerToMain } from '@/lib/python-protocol'
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES } from '@/lib/python-protocol'
import { loadPyodide } from 'pyodide'

type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>
  FS: {
    mkdirTree: (path: string) => void
    writeFile: (path: string, data: string) => void
    unlink: (path: string) => void
  }
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
  setStdin: (options: { stdin: () => string }) => void
  setInterruptBuffer: (buffer: Int32Array) => void
  checkInterrupt: () => void
}

const send = (message: WorkerToMain) => self.postMessage(message)
let pyodide: Pyodide | null = null
const workspace = '/home/pyodide/emipy'
let previousFiles: string[] = []

async function load() {
  // Wasm and standard library are copied from pinned npm package into public/pyodide.
  pyodide = await loadPyodide({
    indexURL: `${self.location.origin}/pyodide/`,
    packageBaseUrl: `${self.location.origin}/pyodide/`,
  }) as Pyodide
  send({ type: 'ready' })
}

void load().catch((error: unknown) => send({ type: 'fatal', message: String(error) }))

self.onmessage = async (event: MessageEvent<MainToWorker>) => {
  const message = event.data
  if (message.type !== 'run' || !pyodide) return
  const { runId } = message
  const interrupt = new Int32Array(message.interruptBuffer)
  const inputState = new Int32Array(message.inputBuffer, 0, 2)
  const inputBytes = new Uint8Array(message.inputBuffer, 8, MAX_INPUT_BYTES)
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let outputBytes = 0
  const relay = (type: 'stdout' | 'stderr', text: string) => {
    if (outputBytes > MAX_OUTPUT_BYTES) return
    outputBytes += encoder.encode(text).byteLength
    send({ type, text, runId })
  }
  pyodide.setInterruptBuffer(interrupt)
  pyodide.setStdout({ batched: (text) => relay('stdout', `${text}\n`) })
  pyodide.setStderr({ batched: (text) => relay('stderr', `${text}\n`) })
  pyodide.setStdin({ stdin: () => {
    Atomics.store(inputState, 0, 0)
    send({ type: 'stdin-request', runId })
    while (Atomics.load(inputState, 0) === 0) {
      Atomics.wait(inputState, 0, 0, 50)
      pyodide?.checkInterrupt()
    }
    pyodide?.checkInterrupt()
    const length = Atomics.load(inputState, 1)
    // TextDecoder rejects SharedArrayBuffer views in browsers. Copy first.
    return decoder.decode(Uint8Array.from(inputBytes.subarray(0, length)))
  } })
  try {
    pyodide.FS.mkdirTree(workspace)
    for (const name of previousFiles) pyodide.FS.unlink(`${workspace}/${name}`)
    for (const file of message.files) pyodide.FS.writeFile(`${workspace}/${file.name}`, file.code)
    const modules = [...new Set([...previousFiles, ...message.files.map((file) => file.name)].map((name) => name.slice(0, -3)))]
    previousFiles = message.files.map((file) => file.name)
    await pyodide.runPythonAsync(`import sys, importlib\nif ${JSON.stringify(workspace)} not in sys.path: sys.path.insert(0, ${JSON.stringify(workspace)})\nfor name in ${JSON.stringify(modules)}: sys.modules.pop(name, None)\nimportlib.invalidate_caches()`)
    await pyodide.runPythonAsync(message.code)
    send({ type: 'done', runId })
  } catch (error) {
    if (Atomics.load(interrupt, 0) === 2 || String(error).includes('KeyboardInterrupt')) {
      send({ type: 'stopped', runId })
    } else {
      send({ type: 'stderr', text: `${String(error)}\n`, runId })
      send({ type: 'done', runId })
    }
  }
}
