import { beforeAll, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { executeC, loadCToolchain, C_ASSET_BASE, type CFile } from './compiler'
import { programSnapshotSchema } from '../agent-contract'

let modules: Awaited<ReturnType<typeof loadCToolchain>>
beforeAll(async () => {
  modules = await loadCToolchain(async (name) => {
    const bytes = await readFile(`public${C_ASSET_BASE}${name}`)
    return Uint8Array.from(bytes).buffer
  })
})

async function run(code: string, files: CFile[] = [], stdin = '') {
  const output = { stdout: '', stderr: '', exitCode: -1 }
  let remaining = new TextEncoder().encode(stdin)
  const decoders = [new TextDecoder(), new TextDecoder()]
  output.exitCode = await executeC(modules, code, files, {
    write: (fd, bytes) => { output[fd === 2 ? 'stderr' : 'stdout'] += decoders[fd === 2 ? 1 : 0].decode(bytes, { stream: true }) },
    read: (length) => { const bytes = remaining.slice(0, length); remaining = remaining.slice(length); return bytes },
    phase: () => {},
  })
  return output
}

test('real C compiler: UTF-8 stdout, stderr, interactive prompts and scanf', async () => {
  const output = await run('#include <stdio.h>\nint main(void) { int a, b; printf("Età? "); if (scanf("%d%d", &a, &b) != 2) return 2; printf("%d\\n", a+b); fprintf(stderr,"avviso\\n"); return 0; }', [], '20\n22\n')
  expect(output).toEqual({ stdout: 'Età? 42\n', stderr: 'avviso\n', exitCode: 0 })
})

test('multiple translation units and local headers', async () => {
  const output = await run('#include <stdio.h>\n#include "somma.h"\nint main(void) { printf("%d\\n", somma(2,3)); }', [
    { name: 'somma.h', code: 'int somma(int, int);' },
    { name: 'somma.c', code: '#include "somma.h"\nint somma(int a, int b) { return a+b; }' },
  ])
  expect(output.stdout).toBe('5\n')
  expect(output.exitCode).toBe(0)
})

test('compiler and linker errors do not execute stale binaries', async () => {
  expect((await run('int main(void) { return 0; }')).exitCode).toBe(0)
  const syntax = await run('int main(void) { syntax error }')
  expect(syntax.exitCode).not.toBe(0)
  expect(syntax.stderr).toContain('main.c:1:')
  expect(syntax.stdout).toBe('')
  const linking = await run('int missing(void); int main(void) { return missing(); }')
  expect(linking.exitCode).not.toBe(0)
  expect(linking.stderr).toContain('missing')
})

test('exit codes, memory traps and fresh filesystems', async () => {
  expect((await run('int main(void) { return 7; }')).exitCode).toBe(7)
  await expect(run('int main(void) { __builtin_trap(); }')).rejects.toThrow()
  expect((await run('#include "old.h"\nint main(void) { return VALUE; }', [{ name: 'old.h', code: '#define VALUE 0' }])).exitCode).toBe(0)
  const next = await run('#include "old.h"\nint main(void) { return VALUE; }')
  expect(next.exitCode).not.toBe(0)
  expect(next.stderr).toContain('old.h')
})

test('snapshots accept legacy Python and reject mixed, reserved or duplicate files', () => {
  expect(programSnapshotSchema.parse({ mainCode: '', files: [] }).language).toBe('python')
  for (const names of [['main.c'], ['__emipy_io.c'], ['../escape.c'], ['modulo.py'], ['x.h', 'x.h']]) {
    expect(programSnapshotSchema.safeParse({ language: 'c', mainCode: '', files: names.map((name) => ({ name, code: '' })) }).success).toBe(false)
  }
  expect(programSnapshotSchema.safeParse({ language: 'c', mainCode: '', files: [{ name: 'util.h', code: '' }] }).success).toBe(true)
})
