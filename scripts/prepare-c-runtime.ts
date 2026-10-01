import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import manifest from '../src/lib/c-runtime/assets.json'

const directory = resolve(import.meta.dir, '../public/c-runtime', manifest.revision)
await mkdir(directory, { recursive: true })
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
await Promise.all(Object.entries(manifest.assets).map(async ([name, expected]) => {
  const target = resolve(directory, name)
  try { if (sha256(await readFile(target)) === expected) return } catch { /* download missing asset */ }
  const url = `https://raw.githubusercontent.com/binji/wasm-clang/${manifest.revision}/${name}`
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`Download ${name}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (sha256(bytes) !== expected) throw new Error(`Checksum non valido: ${name}`)
  await writeFile(`${target}.tmp`, bytes)
  await rename(`${target}.tmp`, target)
  console.log(`Runtime C: ${name} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MiB)`)
}))
