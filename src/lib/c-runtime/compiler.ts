import { App, MemFS, Tar } from './vendor/wasi.js'
import manifest from './assets.json'
import { languages, type CompiledLanguage } from '../languages'

export const C_ASSET_BASE = `/c-runtime/${manifest.revision}/`
export type CFile = { name: string; code: string }
export type CPhase = 'compiling' | 'linking' | 'running'
type Modules = { clang: WebAssembly.Module; lld: WebAssembly.Module; memfs: WebAssembly.Module; sysroot: ArrayBuffer }
type Host = {
  write: (fd: number, bytes: Uint8Array) => void
  read: (length: number) => Uint8Array
  phase: (phase: CPhase) => void
}

export async function loadCToolchain(read: (name: string) => Promise<ArrayBuffer>): Promise<Modules> {
  const [clang, lld, memfs, sysroot] = await Promise.all([
    read('clang').then((bytes) => WebAssembly.compile(bytes)),
    read('lld').then((bytes) => WebAssembly.compile(bytes)),
    read('memfs').then((bytes) => WebAssembly.compile(bytes)),
    read('sysroot.tar'),
  ])
  return { clang, lld, memfs, sysroot }
}

// A fresh filesystem and WASM instance for every run prevents stale objects,
// globals and user-created files from leaking into the next execution.
export async function executeCompiled(modules: Modules, code: string, files: CFile[], host: Host, language: CompiledLanguage = 'c'): Promise<number> {
  const fs = new MemFS({
    compileStreaming: async () => modules.memfs,
    memfsFilename: 'memfs',
    hostWrite: host.write,
    hostRead: host.read,
  })
  await fs.ready
  new Tar(modules.sysroot).untar(fs)
  const encoder = new TextEncoder()
  const mainFile = languages[language].mainFile
  fs.addFile(mainFile, encoder.encode(code))
  for (const file of files) fs.addFile(file.name, encoder.encode(file.code))
  // A constructor flushes prompts before scanf/getchar block, without rewriting
  // the user's main signature or adding special APIs to their C program.
  fs.addFile('__emipy_io.c', encoder.encode('#include <stdio.h>\n__attribute__((constructor)) static void emipy_io(void) { setvbuf(stdout, 0, _IONBF, 0); setvbuf(stderr, 0, _IONBF, 0); }\n'))
  const sources = [mainFile, ...files.filter((file) => /\.(c|cpp|cc|cxx)$/.test(file.name)).map((file) => file.name), '__emipy_io.c']
  const objects: string[] = []
  host.phase('compiling')
  for (const [index, source] of sources.entries()) {
    const object = `__emipy_${index}.o`
    const cpp = !source.endsWith('.c')
    const options = cpp
      // cc1 exceptions remain disabled unless -fexceptions is explicitly enabled.
      ? ['-internal-isystem', '/include/c++/v1', '-std=c++17', '-x', 'c++']
      : ['-std=c11', '-x', 'c']
    const exit = await new App(modules.clang, fs, 'clang', '-cc1', '-emit-obj',
      '-isysroot', '/', ...options, '-internal-isystem', '/lib/clang/8.0.1/include', '-internal-isystem', '/include',
      '-I.', '-O0', '-Wall', '-ferror-limit', '10', '-o', object, source).run()
    if (exit !== 0) return exit
    objects.push(object)
  }
  host.phase('linking')
  const exit = await new App(modules.lld, fs, 'wasm-ld', '--no-threads',
    '-z', 'stack-size=1048576', '--max-memory=67108864', '-Llib/wasm32-wasi',
    'lib/wasm32-wasi/crt1.o', ...objects, ...(language === 'cpp' ? ['-lc++', '-lc++abi'] : []), '-lc', '-o', '__emipy_program.wasm').run()
  if (exit !== 0) return exit
  const module = await WebAssembly.compile(Uint8Array.from(fs.getFileContents('__emipy_program.wasm')))
  host.phase('running')
  return new App(module, fs, 'main').run()
}
