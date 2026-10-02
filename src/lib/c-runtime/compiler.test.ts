import { beforeAll, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { executeCompiled, loadCToolchain, C_ASSET_BASE, type CFile } from './compiler'
import type { CompiledLanguage } from '../languages'
import { programSnapshotSchema } from '../agent-contract'

let modules: Awaited<ReturnType<typeof loadCToolchain>>
beforeAll(async () => {
  modules = await loadCToolchain(async (name) => {
    const bytes = await readFile(`public${C_ASSET_BASE}${name}`)
    return Uint8Array.from(bytes).buffer
  })
})

async function run(code: string, files: CFile[] = [], stdin = '', language: CompiledLanguage = 'c') {
  const output = { stdout: '', stderr: '', exitCode: -1 }
  let remaining = new TextEncoder().encode(stdin)
  const decoders = [new TextDecoder(), new TextDecoder()]
  output.exitCode = await executeCompiled(modules, code, files, {
    write: (fd, bytes) => { output[fd === 2 ? 'stderr' : 'stdout'] += decoders[fd === 2 ? 1 : 0].decode(bytes, { stream: true }) },
    read: (length) => { const bytes = remaining.slice(0, length); remaining = remaining.slice(length); return bytes },
    phase: () => {},
  }, language)
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


test('C++17: streams, strings, vectors, templates, smart pointers and RAII', async () => {
  const output = await run(`#include <iostream>
#include <string>
#include <vector>
#include <numeric>
#include <memory>
#include <optional>
#include <utility>
template<typename T> T twice(T x) { return x+x; }
struct Guard { ~Guard() { std::cerr << "cleanup\\n"; } };
int main() {
  Guard guard;
  std::string name; int n;
  std::cout << "Nome? "; std::getline(std::cin, name);
  std::cout << "Numero? "; std::cin >> n;
  auto value = std::make_unique<int>(twice(n));
  std::optional<int> stored = *value;
  auto [left, right] = std::pair<int, int>{stored.value(), 0};
  std::vector<int> values{left, right};
  std::cout << name << " " << std::accumulate(values.begin(), values.end(), 0) << std::endl;
}`, [], 'Ada\n21\n', 'cpp')
  expect(output).toEqual({ stdout: 'Nome? Numero? Ada 42\n', stderr: 'cleanup\n', exitCode: 0 })
})

test('C++ links cpp, cc, cxx and C translation units with local headers', async () => {
  const output = await run('#include <iostream>\n#include "util.hpp"\nint main() { std::cout << cpp()+cc()+cxx()+c() << std::endl; }', [
    { name: 'util.hpp', code: 'int cpp(); int cc(); int cxx(); extern "C" int c();' },
    { name: 'one.cpp', code: '#include "util.hpp"\nint cpp() { return 10; }' },
    { name: 'two.cc', code: 'int cc() { return 10; }' },
    { name: 'three.cxx', code: 'int cxx() { return 10; }' },
    { name: 'four.c', code: 'int c(void) { return 12; }' },
  ], '', 'cpp')
  expect(output.stdout).toBe('42\n')
  expect(output.exitCode).toBe(0)
})

test('C++ diagnostics, exit codes and unsupported exceptions', async () => {
  expect((await run('int main() { return 7; }', [], '', 'cpp')).exitCode).toBe(7)
  const syntax = await run('int main() { invalid syntax }', [], '', 'cpp')
  expect(syntax.exitCode).not.toBe(0)
  expect(syntax.stderr).toContain('main.cpp:1:')
  const exceptions = await run('int main() { throw 42; }', [], '', 'cpp')
  expect(exceptions.exitCode).not.toBe(0)
  expect(exceptions.stderr).toContain('exceptions disabled')
})

test('C++ snapshots validate canonical main, headers and mixed C sources', () => {
  for (const name of ['main.cpp', '__emipy_io.c', '../escape.cpp', 'module.py']) {
    expect(programSnapshotSchema.safeParse({ language: 'cpp', mainCode: '', files: [{ name, code: '' }] }).success).toBe(false)
  }
  for (const name of ['util.cpp', 'util.cc', 'util.cxx', 'util.c', 'util.hpp', 'util.hh', 'util.hxx', 'util.h']) {
    expect(programSnapshotSchema.safeParse({ language: 'cpp', mainCode: '', files: [{ name, code: '' }] }).success).toBe(true)
  }
})
