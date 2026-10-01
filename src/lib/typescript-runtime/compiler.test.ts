import { beforeAll, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core'
import { compileTypeScript } from './compiler'
import { executeJavaScript } from '../javascript-runtime/engine'
import { programSnapshotSchema } from '../agent-contract'
let libraries: Record<string, string>, engine: QuickJSWASMModule
beforeAll(async () => {
  libraries = Object.fromEntries(await Promise.all((await readdir('node_modules/typescript/lib')).filter(name => /^lib.*\.d\.ts$/.test(name)).map(async name => [name, await readFile(`node_modules/typescript/lib/${name}`, 'utf8')])))
  engine = await newQuickJSWASMModuleFromVariant(variant)
})
function run(code: string, files: { name: string; code: string }[] = []) {
  const compiled = compileTypeScript(code, files, libraries)
  let stdout = '', stderr = ''
  if (!compiled.success) return { ...compiled, stdout, stderr }
  const result = executeJavaScript(engine, compiled.code, compiled.files, {
    write: (kind, text) => { if (kind === 'stdout') stdout += text; else stderr += text },
    read: () => '21', extensionlessImports: true,
  })
  return { ...compiled, ...result, stdout, stderr }
}
test('strict types, generics, interfaces, enums and console execute in QuickJS', () => {
  const result = run('interface Box<T> { value: T }; enum Mode { Double = 2 }; const box: Box<number> = {value: Number(input("Numero? "))}; console.log(box.value * Mode.Double);')
  expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'Numero? 42\n', stderr: '' })
})
test('multiple modules, type-only imports, extensionless and explicit .ts imports, async/await', () => {
  const result = run('import type {Value} from "./types.ts"; import {twice} from "./util"; const value: Value = {n:21}; console.log(await twice(value.n));', [
    { name: 'types.ts', code: 'export interface Value {n:number}' },
    { name: 'util.ts', code: 'import {factor} from "./factor.ts"; export async function twice(n:number): Promise<number> { return n*factor; }' },
    { name: 'factor.ts', code: 'export const factor = 2;' },
  ])
  expect(result).toMatchObject({ success: true, exitCode: 0, stdout: '42\n', stderr: '' })
})
test('type and syntax errors name original files and prevent execution', () => {
  const type = run('console.log("must not run");\nconst n: number = "wrong";')
  expect(type.success).toBe(false)
  expect(type.diagnostics).toContain('main.ts:2:7 TS2322')
  expect(type.stdout).toBe('')
  const nested = run('import {n} from "./util.ts"; console.log(n);', [{ name: 'util.ts', code: 'export const n: number = "wrong";' }])
  expect(nested.success).toBe(false)
  expect(nested.diagnostics).toContain('util.ts:1:14 TS2322')
  expect(run('const = ;').success).toBe(false)
})
test('only ES and console APIs are typed; imports cannot access npm or the browser', () => {
  expect(run('console.log([1,2].map(n => n*2));').success).toBe(true)
  for (const code of ['document.body;', 'fetch("https://example.com");', 'process.exit();', 'import "npm-package";']) expect(run(code).success).toBe(false)
})
test('fresh compilation does not reuse stale modules and filenames remain language-specific', () => {
  expect(run('import {n} from "./util";', [{ name: 'util.ts', code: 'export const n = 1;' }]).success).toBe(true)
  expect(run('import {n} from "./util";').success).toBe(false)
  expect(programSnapshotSchema.safeParse({ language: 'typescript', mainCode: '', files: [{ name: 'util.ts', code: '' }] }).success).toBe(true)
  for (const names of [['main.ts'], ['util.js'], ['../util.ts'], ['__emipy_console.ts'], ['util.ts','util.ts']]) expect(programSnapshotSchema.safeParse({ language: 'typescript', mainCode: '', files: names.map(name => ({ name, code: '' })) }).success).toBe(false)
})
