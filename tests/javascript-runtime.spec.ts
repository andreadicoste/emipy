import { test, expect, type Page } from '@playwright/test'
async function newProgram(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '')
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/app\/languages/)
  await page.getByRole('button', { name: /^JavaScript Impara/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/javascript$/)
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuovo playground' }).click()
  await page.getByRole('menuitem', { name: 'Nuovo programma JavaScript', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/playground\//)
  await ready(page)
  await expect(page.getByRole('button', { name: 'main.js', exact: true })).toBeVisible()
}
async function setCode(page: Page, code: string) {
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}
const start = (page: Page) => page.getByRole('button', { name: 'Avvia programma' }).click()
const ready = (page: Page) => expect(page.getByRole('button', { name: 'Avvia programma' })).toBeEnabled({ timeout: 90_000 })
const output = (page: Page) => page.getByRole('region', { name: 'Output programma' }).getByTestId('output')

test('JavaScript: WASM asset, catalog, console, UTF-8 input, save, errors and STOP', async ({ page }) => {
  test.setTimeout(120_000)
  const assets: string[] = []
  page.on('response', response => { if (response.url().includes('.wasm') && response.ok()) assets.push(response.url()) })
  await newProgram(page)
  expect(assets.some(url => url.includes('emscripten-module'))).toBe(true)
  await start(page)
  await expect(output(page)).toContainText('Ciao, Emipy!')
  await ready(page)
  await setCode(page, 'const name = input("Nome? "); const n = Number(prompt("Età? ")); console.log("Ciao", name, n*2); console.error("avviso");')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('prompt')
  await start(page)
  for (const [prompt, text] of [['Nome?', 'Adà'], ['Età?', '21']]) {
    await expect(output(page)).toContainText(prompt)
    await expect(page.getByLabel('Input programma')).toBeEnabled()
    await page.getByLabel('Input programma').fill(text)
    await page.getByRole('button', { name: 'Invia', exact: true }).click()
  }
  await expect(output(page)).toContainText('Ciao Adà 42')
  await expect(output(page)).toContainText('avviso')
  await ready(page)
  await setCode(page, 'throw new Error("boom");')
  await start(page)
  await expect(output(page)).toContainText('Error: boom')
  await expect(output(page)).toContainText('main.js')
  await ready(page)
  await setCode(page, 'console.log("Loop avviato"); while(true) {}')
  await start(page)
  await expect(output(page)).toContainText('Loop avviato')
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, 'input("Attendo? ");')
  await start(page)
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, 'console.log("Microtask avviati"); function again() { Promise.resolve().then(again); } again();')
  await start(page)
  await expect(output(page)).toContainText('Microtask avviati')
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, 'for(let i=0; i<50000; i++) console.log("A".repeat(32));')
  await start(page)
  await expect(output(page)).toContainText('Output troncato: limite 1 MiB.')
  await ready(page)
  await setCode(page, 'console.log(typeof window, typeof fetch, typeof process, "Ripartito");')
  await start(page)
  await expect(output(page)).toContainText('undefined undefined undefined Ripartito')
})

test('JavaScript: ES modules, async/await and persisted additional files', async ({ page }) => {
  await newProgram(page)
  await page.getByRole('button', { name: 'Apri file', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuovo file', exact: true }).click()
  await page.getByLabel('Nome file').fill('util.js')
  await page.getByRole('button', { name: 'Crea file', exact: true }).click()
  await expect(page.getByRole('button', { name: 'util.js', exact: true })).toBeVisible()
  await setCode(page, 'export async function twice(n) { return n*2; }')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.getByRole('button', { name: 'main.js', exact: true }).click()
  await setCode(page, 'import {twice} from "./util.js"; console.log(await twice(21));')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await start(page)
  await expect(output(page)).toContainText('42')
  await ready(page)
  await setCode(page, 'console.log(typeof saved); globalThis.saved = 42;')
  await start(page)
  await expect(output(page)).toContainText('undefined')
  await ready(page)
  await start(page)
  await expect(output(page)).toContainText('undefined')
})

test('JavaScript evaluation: local imports, stdin, EOF, rejection and loop timeout', async ({ page }) => {
  await page.goto('/login')
  const results = await page.evaluate(async () => {
    async function evaluate(code: string, stdin: string[] = []) {
      const worker = new Worker('/src/workers/javascript.worker.ts', { type: 'module' })
      return new Promise<{ stdout: string; stderr: string; exitCode: number; inputExhausted: boolean; timedOut: boolean }>((resolve, reject) => {
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')) }, 20_000)
        worker.onerror = (error) => { clearTimeout(timer); worker.terminate(); reject(new Error(error.message)) }
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') worker.postMessage({ type: 'run', runId: 1, evaluation: true, files: [{ name: 'util.js', code: 'export const twice = n => n*2;' }], stdin, code })
          if (data.type === 'result') { clearTimeout(timer); worker.terminate(); resolve(data) }
          if (data.type === 'fatal') { clearTimeout(timer); worker.terminate(); reject(new Error(data.message)) }
        }
      })
    }
    return [
      await evaluate('import {twice} from "./util.js"; console.log(twice(Number(input()))); console.error("avviso"); console.log(input());', ['21']),
      await evaluate('await Promise.reject(new Error("rejected"));'),
      await evaluate('while(true) {}'),
    ]
  })
  expect(results[0]).toMatchObject({ stdout: '42\nnull\n', stderr: 'avviso\n', exitCode: 0, inputExhausted: true, timedOut: false })
  expect(results[1].exitCode).toBe(1)
  expect(results[1].stderr).toContain('rejected')
  expect(results[2]).toMatchObject({ exitCode: 1, timedOut: true })
})
