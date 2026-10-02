import { test, expect, type Page } from '@playwright/test'

async function newProgram(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '')
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/app\/languages/)
  await page.getByRole('button', { name: /^C\+\+ Impara/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/cpp$/)
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuovo playground' }).click()
  await page.getByRole('menuitem', { name: 'Nuovo programma C++', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/playground\//)
  await ready(page)
  await expect(page.getByRole('button', { name: 'main.cpp', exact: true })).toBeVisible()
}
async function setCode(page: Page, code: string) {
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}
const start = (page: Page) => page.getByRole('button', { name: 'Avvia programma' }).click()
const ready = (page: Page) => expect(page.getByRole('button', { name: 'Avvia programma' })).toBeEnabled({ timeout: 90_000 })
const output = (page: Page) => page.getByRole('region', { name: 'Output programma' }).getByTestId('output')

test('C++: catalog, streams, stdlib, persistence, diagnostics and STOP while running or reading', async ({ page }) => {
  test.setTimeout(120_000)
  await newProgram(page)
  await start(page)
  await expect(output(page)).toContainText('Ciao, Emipy!')
  await ready(page)
  await setCode(page, '#include <iostream>\n#include <string>\n#include <vector>\n#include <numeric>\nint main() { std::string name; int n; std::cout << "Nome? "; std::getline(std::cin, name); std::cout << "Numero? "; std::cin >> n; std::vector<int> v{n,n}; std::cout << name << " " << std::accumulate(v.begin(),v.end(),0) << std::endl; }')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('std::vector')
  await start(page)
  for (const [prompt, input] of [['Nome?', 'Ada'], ['Numero?', '21']]) {
    await expect(output(page)).toContainText(prompt)
    await expect(page.getByLabel('Input programma')).toBeEnabled()
    await page.getByLabel('Input programma').fill(input)
    await page.getByRole('button', { name: 'Invia', exact: true }).click()
  }
  await expect(output(page)).toContainText('Ada 42')
  await ready(page)
  await setCode(page, 'int main() { invalid syntax }')
  await start(page)
  await expect(output(page)).toContainText('main.cpp:1:')
  await ready(page)
  await setCode(page, '#include <iostream>\nint main() { std::cout << "Loop avviato" << std::endl; for (;;) {} }')
  await start(page)
  await expect(output(page)).toContainText('Loop avviato')
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, '#include <iostream>\nint main() { int n; std::cin >> n; }')
  await start(page)
  await expect(page.getByLabel('Input programma')).toBeEnabled()
  await page.getByRole('button', { name: 'Ferma programma' }).click()
  await ready(page)
  await setCode(page, '#include <iostream>\nint main() { std::cout << "Ripartito" << std::endl; }')
  await start(page)
  await expect(output(page)).toContainText('Ripartito')
})

test('C++: additional cpp and hpp files save, compile and link after reload', async ({ page }) => {
  await newProgram(page)
  for (const file of [
    { name: 'util.hpp', code: 'int twice(int);' },
    { name: 'util.cpp', code: '#include "util.hpp"\nint twice(int x) { return x*2; }' },
  ]) {
    await page.getByRole('button', { name: 'Apri file', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Nuovo file', exact: true }).click()
    await page.getByLabel('Nome file').fill(file.name)
    await page.getByRole('button', { name: 'Crea file', exact: true }).click()
    await expect(page.getByRole('button', { name: file.name, exact: true })).toBeVisible()
    await setCode(page, file.code)
    await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  }
  await page.getByRole('button', { name: 'main.cpp', exact: true }).click()
  await setCode(page, '#include <iostream>\n#include "util.hpp"\nint main() { std::cout << twice(21) << std::endl; }')
  await expect(page.getByRole('status').filter({ hasText: 'Salvato' })).toHaveText('Salvato')
  await page.reload()
  await ready(page)
  await start(page)
  await expect(output(page)).toContainText('42')
})

test('C++ evaluation reports stdin, stderr, exit codes, EOF and compilation failure', async ({ page }) => {
  await page.goto('/login')
  const results = await page.evaluate(async () => {
    async function evaluate(code: string, stdin: string[]) {
      const worker = new Worker('/src/workers/compiled.worker.ts', { type: 'module' })
      return new Promise<{ stdout: string; stderr: string; exitCode: number; inputExhausted: boolean; compileFailed: boolean }>((resolve, reject) => {
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')) }, 30_000)
        worker.onerror = (error) => { clearTimeout(timer); worker.terminate(); reject(new Error(error.message)) }
        worker.onmessage = ({ data }) => {
          if (data.type === 'ready') worker.postMessage({ type: 'run', language: 'cpp', runId: 1, evaluation: true, files: [], stdin, code })
          if (data.type === 'result') { clearTimeout(timer); worker.terminate(); resolve(data) }
          if (data.type === 'fatal') { clearTimeout(timer); worker.terminate(); reject(new Error(data.message)) }
        }
      })
    }
    return [
      await evaluate('#include <iostream>\nint main() { int n; std::cin >> n; std::cout << n*2 << std::endl; std::cerr << "avviso"; while (std::cin.get() != EOF) {} return 7; }', ['21']),
      await evaluate('int main() { invalid syntax }', []),
    ]
  })
  expect(results[0]).toMatchObject({ stdout: '42\n', stderr: 'avviso', exitCode: 7, inputExhausted: true, compileFailed: false })
  expect(results[1].compileFailed).toBe(true)
  expect(results[1].exitCode).not.toBe(0)
  expect(results[1].stderr).toContain('main.cpp:1:')
})
