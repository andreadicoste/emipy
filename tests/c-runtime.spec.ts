import { test, expect, type Page } from '@playwright/test'

async function newProgram(page: Page, language: 'C' | 'Python') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '')
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/app\/languages/)
  await page.getByRole('button', { name: 'Nuovo playground' }).click()
  await page.getByRole('menuitem', { name: `Nuovo programma ${language}`, exact: true }).click()
  await expect(page).toHaveURL(/\/app\/playground\//)
  await expect(page.getByRole('button', { name: 'Avvia programma' })).toBeEnabled({ timeout: 90_000 })
}

async function setCode(page: Page, code: string) {
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}
const start = (page: Page) => page.getByRole('button', { name: 'Avvia programma' }).click()
const ready = (page: Page) => expect(page.getByRole('button', { name: 'Avvia programma' })).toBeEnabled({ timeout: 90_000 })

test('C: creation, UTF-8 prompts, repeated scanf, persistence, compiler errors and STOP', async ({ page }) => {
  test.setTimeout(120_000)
  await newProgram(page, 'C')
  await expect(page.getByRole('button', { name: 'main.c', exact: true })).toBeVisible()
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Ciao, Emipy!')
  await ready(page)
  await setCode(page, '#include <stdio.h>\nint main(void) { int a,b; printf("Età? "); scanf("%d", &a); printf("Altro? "); scanf("%d", &b); printf("Totale %d\\n", a+b); return 0; }')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('scanf')
  await start(page)
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Età?')
  await page.getByLabel('Input programma').fill('20')
  await page.getByRole('button', { name: 'Invia', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Altro?')
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await page.getByLabel('Input programma').fill('22')
  await page.getByRole('button', { name: 'Invia', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Totale 42')
  await ready(page)
  await setCode(page, 'int main(void) { invalid syntax }')
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('main.c:1:')
  await ready(page)
  await setCode(page, 'int main(void) { for (;;) {} }')
  await start(page)
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, '#include <stdio.h>\nint main(void) { puts("Dopo STOP"); return 0; }')
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Dopo STOP')
  await ready(page)
  await setCode(page, '#include <stdio.h>\nint main(void) { getchar(); }')
  await start(page)
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, '#include <stdio.h>\nint main(void) { for(int i=0; i<1200000; ++i) putchar(65); return 0; }')
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' })).toContainText('Output troncato: limite 1 MiB.')
  await ready(page)
})

test('C: additional source and header files are saved and linked', async ({ page }) => {
  await newProgram(page, 'C')
  for (const file of [
    { name: 'util.h', code: 'int twice(int);' },
    { name: 'util.c', code: '#include "util.h"\nint twice(int x) { return x*2; }' },
  ]) {
    await page.getByRole('button', { name: 'Apri file', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Nuovo file', exact: true }).click()
    await page.getByLabel('Nome file').fill(file.name)
    await page.getByRole('button', { name: 'Crea file', exact: true }).click()
    await expect(page.getByRole('button', { name: file.name, exact: true })).toBeVisible()
    await setCode(page, file.code)
    await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  }
  await page.getByRole('button', { name: 'main.c', exact: true }).click()
  await setCode(page, '#include <stdio.h>\n#include "util.h"\nint main(void) { printf("%d\\n", twice(21)); }')
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('42')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await start(page)
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('42')
})

test('Python: runtime still handles input, output and STOP', async ({ page }) => {
  await newProgram(page, 'Python')
  await expect(page.getByRole('button', { name: 'main.py', exact: true })).toBeVisible()
  await setCode(page, 'name = input("Nome? ")\nprint("Ciao " + name)')
  await start(page)
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await page.getByLabel('Input programma').fill('Ada')
  await page.getByRole('button', { name: 'Invia', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Output programma' }).getByTestId('output')).toContainText('Ciao Ada')
  await ready(page)
  await setCode(page, 'while True:\n    pass')
  await start(page)
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
})

test('C: evaluation worker returns real results and EOF', async ({ page }) => {
  await page.goto('/login')
  const result = await page.evaluate(async () => {
    const worker = new Worker('/src/workers/compiled.worker.ts', { type: 'module' })
    return new Promise<{ stdout: string; exitCode: number; inputExhausted: boolean; compileFailed: boolean }>((resolve, reject) => {
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')) }, 30_000)
      worker.onerror = (error) => { clearTimeout(timer); worker.terminate(); reject(new Error(error.message)) }
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') worker.postMessage({ type: 'run', runId: 1, evaluation: true, files: [], stdin: ['21'], code: '#include <stdio.h>\nint main(void) { int x; scanf("%d", &x); printf("%d\\n", x*2); while(getchar() != EOF) {} return 0; }' })
        if (data.type === 'result') { clearTimeout(timer); worker.terminate(); resolve(data) }
        if (data.type === 'fatal') { clearTimeout(timer); worker.terminate(); reject(new Error(data.message)) }
      }
    })
  })
  expect(result.stdout).toBe('42\n')
  expect(result.exitCode).toBe(0)
  expect(result.inputExhausted).toBe(true)
  expect(result.compileFailed).toBe(false)
})
