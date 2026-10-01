import { beforeAll, expect, test } from 'bun:test'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core'
import { executeJavaScript } from './engine'
import { programSnapshotSchema } from '../agent-contract'
let engine: QuickJSWASMModule
beforeAll(async () => { engine = await newQuickJSWASMModuleFromVariant(variant) })
function run(code: string, files: { name: string; code: string }[] = [], inputs: string[] = [], timeoutMs?: number) {
  let stdout = '', stderr = '', index = 0
  const result = executeJavaScript(engine, code, files, {
    write: (kind, text) => { if (kind === 'stdout') stdout += text; else stderr += text },
    read: () => inputs[index++] ?? null,
    timeoutMs,
  })
  return { ...result, stdout, stderr }
}
test('console, objects, UTF-8, repeated input and EOF', () => {
  expect(run('const name = input("Nome? "); const n = Number(prompt("Età? ")); console.log(name, n*2, {ok:true}); console.error("avviso"); console.log(input());', [], ['Ada', '21'])).toEqual({ exitCode: 0, timedOut: false, stdout: 'Nome? Età? Ada 42 {"ok":true}\nnull\n', stderr: 'avviso\n' })
})
test('local modules, async jobs and top-level await', () => {
  const result = run('import {twice} from "./util.js"; const n = await Promise.resolve(21); console.log(twice(n));', [{ name: 'util.js', code: 'export function twice(n) { return n*2; }' }])
  expect(result).toMatchObject({ exitCode: 0, stdout: '42\n', stderr: '' })
})
test('diagnostics, rejected top-level promises, missing modules and fresh contexts', () => {
  expect(run('globalThis.saved = 42;').exitCode).toBe(0)
  expect(run('console.log(typeof saved);').stdout).toBe('undefined\n')
  for (const code of ['throw null;', 'throw undefined;', 'throw 42;', 'const = ;', 'throw new Error("boom");', 'await Promise.reject(new Error("rejected"));', 'import "./missing.js";', 'import "npm-package";']) {
    const result = run(code)
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  }
  expect(run('await new Promise(() => {});')).toMatchObject({ exitCode: 1 })
})
test('WASM VM has no browser or Node capabilities and interrupts loops/jobs', () => {
  expect(run('console.log(typeof fetch, typeof window, typeof document, typeof process, typeof require);').stdout).toBe('undefined undefined undefined undefined undefined\n')
  expect(run('while(true) {}', [], [], 20)).toMatchObject({ exitCode: 1, timedOut: true })
  expect(run('function again() { Promise.resolve().then(again); } again();', [], [], 20)).toMatchObject({ exitCode: 1, timedOut: true })
  expect(run('console.log("after");').stdout).toBe('after\n')
})
test('JavaScript snapshots reject invalid, reserved and duplicate module names', () => {
  expect(programSnapshotSchema.safeParse({ language: 'javascript', mainCode: '', files: [{ name: 'util.js', code: '' }] }).success).toBe(true)
  for (const names of [['main.js'], ['../util.js'], ['__emipy_console.js'], ['util.py'], ['util.js', 'util.js']]) {
    expect(programSnapshotSchema.safeParse({ language: 'javascript', mainCode: '', files: names.map((name) => ({ name, code: '' })) }).success).toBe(false)
  }
})


test('heap exhaustion fails cleanly and the next program still runs', () => {
  const result = run('const a = new Array(20000000).fill(42);')
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain('out of memory')
  expect(run('console.log("after OOM");').stdout).toBe('after OOM\n')
})


test('nested and dynamic local module imports share state only within a run', () => {
  const result = run('const {answer} = await import("./util.js"); console.log(answer);', [
    { name: 'util.js', code: 'import {twice} from "./math.js"; export const answer = twice(21);' },
    { name: 'math.js', code: 'export const twice = n => n*2;' },
  ])
  expect(result).toMatchObject({ exitCode: 0, stdout: '42\n', stderr: '' })
})
