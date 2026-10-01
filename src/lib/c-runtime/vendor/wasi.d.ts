export class MemFS {
  constructor(options: {
    compileStreaming: (name: string) => Promise<WebAssembly.Module>
    memfsFilename: string
    hostWrite: (fd: number, bytes: Uint8Array) => void
    hostRead: (length: number) => Uint8Array
  })
  ready: Promise<void>
  addFile(path: string, contents: Uint8Array): void
  getFileContents(path: string): Uint8Array
}
export class App {
  constructor(module: WebAssembly.Module, fs: MemFS, name: string, ...args: string[])
  run(): Promise<number>
}
export class Tar {
  constructor(buffer: ArrayBuffer)
  untar(fs: MemFS): void
}
