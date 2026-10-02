import { test, expect, type Page } from '@playwright/test'
async function newProgram(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '')
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/app\/languages/)
  await page.getByRole('button', { name: /^TypeScript Impara/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/typescript$/)
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuovo playground' }).click()
  await page.getByRole('menuitem', { name: 'Nuovo programma TypeScript', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/playground\//)
  await ready(page)
  await expect(page.getByRole('button', { name: 'main.ts', exact: true })).toBeVisible()
}
async function setCode(page: Page, code: string) {
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}
const start = (page: Page) => page.getByRole('button', { name: 'Avvia programma' }).click()
const ready = (page: Page) => expect(page.getByRole('button', { name: 'Avvia programma' })).toBeEnabled({ timeout: 90_000 })
const output = (page: Page) => page.getByRole('region', { name: 'Output programma' }).getByTestId('output')

test('TypeScript: catalog, input, save, type errors, syntax errors and STOP', async ({ page }) => {
  test.setTimeout(120_000)
  await newProgram(page)
  await start(page)
  await expect(output(page)).toContainText('Ciao, Emipy!')
  await ready(page)
  await setCode(page, 'const name: string | null = input("Nome? "); const n: number = Number(prompt("Età? ")); console.log("Ciao", name, n*2);')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('number')
  await start(page)
  for (const [prompt, text] of [['Nome?', 'Adà'], ['Età?', '21']]) {
    await expect(output(page)).toContainText(prompt)
    await expect(page.getByLabel('Input programma')).toBeEnabled()
    await page.getByLabel('Input programma').fill(text)
    await page.getByRole('button', { name: 'Invia', exact: true }).click()
  }
  await expect(output(page)).toContainText('Ciao Adà 42')
  await ready(page)
  await setCode(page, 'console.log("must not run");\nconst n: number = "wrong";')
  await start(page)
  await expect(output(page)).toContainText('main.ts:2:7 TS2322')
  await expect(output(page)).not.toContainText('must not run')
  await ready(page)
  await setCode(page, 'const = ;')
  await start(page)
  await expect(output(page)).toContainText('main.ts:1:')
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
  await start(page)
  // STOP also interrupts the compiler load/type-check phase.
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, 'console.log("Ripartito");')
  await start(page)
  await expect(output(page)).toContainText('Ripartito')
})

test('TypeScript: type-only imports, additional ts modules and persistence', async ({ page }) => {
  await newProgram(page)
  await page.getByRole('button', { name: 'Apri file', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuovo file', exact: true }).click()
  await page.getByLabel('Nome file').fill('util.ts')
  await page.getByRole('button', { name: 'Crea file', exact: true }).click()
  await expect(page.getByRole('button', { name: 'util.ts', exact: true })).toBeVisible()
  await setCode(page, 'export interface Value { n: number }; export async function twice(value: Value): Promise<number> { return value.n*2; }')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.getByRole('button', { name: 'main.ts', exact: true }).click()
  await setCode(page, 'import type {Value} from "./util.ts"; import {twice} from "./util"; const value: Value = {n: 21}; console.log(await twice(value));')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await start(page)
  await expect(output(page)).toContainText('42')
})

test('TypeScript evaluation reports compilation failure separately from runtime errors', async ({ page }) => {
  await page.goto('/login')
  const results = await page.evaluate(async () => {
    async function evaluate(code: string, stdin: string[] = []) {
      const worker = new Worker('/src/workers/typescript.worker.ts', { type: 'module' })
      return new Promise<{ stdout: string; stderr: string; exitCode: number; inputExhausted: boolean; compileFailed: boolean }>((resolve, reject) => {
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')) }, 45_000)
        worker.onerror = (error) => { clearTimeout(timer); worker.terminate(); reject(new Error(error.message)) }
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') worker.postMessage({ type: 'run', language: 'typescript', runId: 1, evaluation: true, files: [{ name: 'util.ts', code: 'export const twice = (n: number): number => n*2;' }], stdin, code })
          if (data.type === 'result') { clearTimeout(timer); worker.terminate(); resolve(data) }
          if (data.type === 'fatal') { clearTimeout(timer); worker.terminate(); reject(new Error(data.message)) }
        }
      })
    }
    return [
      await evaluate('import {twice} from "./util.ts"; console.log(twice(Number(input()))); console.log(input());', ['21']),
      await evaluate('console.log("must not run"); const n: number = "wrong";'),
      await evaluate('throw new Error("boom");'),
    ]
  })
  expect(results[0]).toMatchObject({ stdout: '42\nnull\n', exitCode: 0, inputExhausted: true, compileFailed: false })
  expect(results[1]).toMatchObject({ stdout: '', exitCode: 1, compileFailed: true })
  expect(results[1].stderr).toContain('TS2322')
  expect(results[2]).toMatchObject({ exitCode: 1, compileFailed: false })
  expect(results[2].stderr).toContain('boom')
})
