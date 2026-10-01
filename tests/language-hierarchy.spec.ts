import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_EMAIL ?? '')
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? '')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/app\/languages$/)
}

test('select language before courses; return from lessons to the same language', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'Linguaggi', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fondamenti di Python' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Python/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/python$/)
  await expect(page.getByRole('heading', { name: 'Corsi', exact: true })).toBeVisible()
  await expect(page.locator('.course-card')).toHaveCount(6)
  await page.getByRole('button', { name: /^Fondamenti di Python/ }).click()
  await expect(page).toHaveURL(/\/app\/courses\/course_python_base\//)
  await page.getByRole('button', { name: 'Corsi di Python', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/languages\/python$/)
  await expect(page.getByRole('heading', { name: 'Fondamenti di Python' })).toBeVisible()
  await page.getByRole('button', { name: 'Tutti i linguaggi' }).click()
  await expect(page).toHaveURL(/\/app\/languages$/)
})

test('C has its own empty catalog; selection survives refresh and old links redirect', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /^C Esplora/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/c$/)
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
  await expect(page.locator('.course-card')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
  await page.goto('/app/courses')
  await expect(page).toHaveURL(/\/app\/languages$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/languages$/)
  await page.goto('/app/courses/course_python_base')
  await expect(page).toHaveURL(/\/app\/courses\/course_python_base\//)
  await expect(page.getByRole('button', { name: 'Corsi di Python', exact: true })).toBeVisible()
})

test('language selection and course navigation work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.getByRole('button', { name: /^Python/ }).click()
  await expect(page).toHaveURL(/\/app\/languages\/python$/)
  await expect(page.getByRole('heading', { name: 'Fondamenti di Python' })).toBeVisible()
  await page.getByRole('button', { name: 'Tutti i linguaggi' }).click()
  await page.getByRole('button', { name: /^C Esplora/ }).click()
  await expect(page.getByRole('heading', { name: 'Corsi in arrivo' })).toBeVisible()
})

test('unknown language returns 404 instead of another language catalog', async ({ page }) => {
  await login(page)
  const response = await page.goto('/app/languages/ruby')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Fondamenti di Python' })).toHaveCount(0)
})
