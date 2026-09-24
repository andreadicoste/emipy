import { loadPyodide } from 'pyodide'
import { MAX_OUTPUT_BYTES } from '@/lib/python-protocol'

type Request = { type: 'run'; runId: number; code: string; files: { name: string; code: string }[]; stdin: string[] }
type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>
  FS: { mkdirTree: (path: string) => void; writeFile: (path: string, data: string) => void; unlink: (path: string) => void }
  setStdout: (options: { write: (buffer: Uint8Array) => number }) => void
  setStderr: (options: { write: (buffer: Uint8Array) => number }) => void
  setStdin: (options: { stdin: () => string }) => void
}

const workspace = '/home/pyodide/emipy-evaluation'
let pyodide: Pyodide | null = null
let previousFiles: string[] = []

void loadPyodide({ indexURL: `${self.location.origin}/pyodide/`, packageBaseUrl: `${self.location.origin}/pyodide/` })
  .then((runtime) => { pyodide = runtime as Pyodide; self.postMessage({ type: 'ready' }) })
  .catch((error: unknown) => self.postMessage({ type: 'fatal', message: String(error) }))

self.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data
  if (message.type !== 'run' || !pyodide) return
  let stdout = '', stderr = '', inputIndex = 0, inputExhausted = false
  const append = (target: 'stdout' | 'stderr', text: string) => {
    if (target === 'stdout') stdout = (stdout + text).slice(0, MAX_OUTPUT_BYTES)
    else stderr = (stderr + text).slice(0, MAX_OUTPUT_BYTES)
  }
  const writeChunk = (target: 'stdout' | 'stderr') => {
    const streamDecoder = new TextDecoder()
    return (buffer: Uint8Array) => {
      const text = streamDecoder.decode(buffer, { stream: true })
      if (text) append(target, text)
      return buffer.length
    }
  }
  pyodide.setStdout({ write: writeChunk('stdout') })
  pyodide.setStderr({ write: writeChunk('stderr') })
  pyodide.setStdin({ stdin: () => {
    if (inputIndex >= message.stdin.length) { inputExhausted = true; return '' }
    return message.stdin[inputIndex++]
  } })
  try {
    pyodide.FS.mkdirTree(workspace)
    for (const name of previousFiles) pyodide.FS.unlink(`${workspace}/${name}`)
    for (const file of message.files) pyodide.FS.writeFile(`${workspace}/${file.name}`, file.code)
    const modules = [...new Set([...previousFiles, ...message.files.map((file) => file.name)].map((name) => name.slice(0, -3)))]
    previousFiles = message.files.map((file) => file.name)
    await pyodide.runPythonAsync(`import sys, importlib\nif ${JSON.stringify(workspace)} not in sys.path: sys.path.insert(0, ${JSON.stringify(workspace)})\nfor name in ${JSON.stringify(modules)}: sys.modules.pop(name, None)\nimportlib.invalidate_caches()`)
    await pyodide.runPythonAsync(message.code)
  } catch (error) {
    append('stderr', `${String(error)}\n`)
  }
  try { await pyodide.runPythonAsync('import sys; sys.stdout.flush(); sys.stderr.flush()') } catch { /* output already captured or runtime stopped */ }
  self.postMessage({ type: 'result', runId: message.runId, stdout, stderr, timedOut: false, inputExhausted })
}
