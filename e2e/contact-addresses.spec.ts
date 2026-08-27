import { test, expect } from '@playwright/test'

/**
 * The address list is built in the browser, so only a real browser proves the
 * repeated inputs zip back into the right rows.
 */

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

test.describe('Contact addresses', () => {
  test('keeps several addresses and groups them by type', async ({ page }) => {
    const email = uniqueEmail('addr')
    const last = `Addr${Date.now().toString().slice(-6)}`
    const fullName = `Ada ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(email)

    await expect(page.getByText('No addresses yet.')).toBeVisible()

    // Two offices and a home — the same type twice is a normal situation.
    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 1 type').selectOption('Work')
    await page.getByLabel('Address 1 city').fill('San Francisco')

    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 2 type').selectOption('Work')
    await page.getByLabel('Address 2 city').fill('Oakland')

    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 3 type').selectOption('Home')
    await page.getByLabel('Address 3 city').fill('London')

    await page.getByRole('button', { name: 'Create contact' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: fullName }),
    ).toBeVisible()

    // Home is listed before Work, and both offices survive.
    const addresses = page.locator('dd', { hasText: 'London' }).first()
    await expect(addresses).toContainText('Home')
    await expect(addresses).toContainText('Work')
    await expect(addresses).toContainText('San Francisco')
    await expect(addresses).toContainText('Oakland')

    // The editor lists them in stored order, not the grouped display order —
    // rows jumping around as you change a type would be worse than useless.
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByLabel('Address 1 city')).toHaveValue('San Francisco')
    await expect(page.getByLabel('Address 2 city')).toHaveValue('Oakland')
    await expect(page.getByLabel('Address 3 city')).toHaveValue('London')

    // Removing the middle row keeps the other two intact.
    await page.getByRole('button', { name: 'Remove address 2' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    const remaining = page.locator('dd', { hasText: 'London' }).first()
    await expect(remaining).toContainText('San Francisco')
    await expect(remaining).not.toContainText('Oakland')

    await page.getByRole('button', { name: `Delete ${fullName}` }).click()
    await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
    await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
  })

  test('a rejected submit keeps every row the user typed', async ({ page }) => {
    const email = `keep-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
    const last = `Keep${Date.now().toString().slice(-6)}`

    // Take the email first, so the second submit is guaranteed to be rejected.
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('First')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(email)
    await page.getByRole('button', { name: 'Create contact' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: `First ${last}` }),
    ).toBeVisible()

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Second')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(email)

    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 1 type').selectOption('Work')
    await page.getByLabel('Address 1 city').fill('San Francisco')
    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 2 city').fill('London')

    await page.getByRole('button', { name: 'Create contact' }).click()
    await expect(page.getByText(/already/i).first()).toBeVisible()

    // React resets the form once the action resolves. Both rows — and the type
    // select, which a reset drops back to its first option — must come back.
    await expect(page.getByLabel('Address 1 type')).toHaveValue('Work')
    await expect(page.getByLabel('Address 1 city')).toHaveValue('San Francisco')
    await expect(page.getByLabel('Address 2 type')).toHaveValue('Home')
    await expect(page.getByLabel('Address 2 city')).toHaveValue('London')

    await page.goto(`/contacts?q=${last}`)
    await page.getByRole('link', { name: `First ${last}`, exact: true }).click()
    await page.getByRole('button', { name: `Delete First ${last}` }).click()
    await page.getByRole('button', { name: `Confirm deleting First ${last}` }).click()
    await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
  })

  test('a row left blank is dropped rather than rejected', async ({ page }) => {
    const email = uniqueEmail('blank')
    const last = `Blank${Date.now().toString().slice(-6)}`
    const fullName = `Ada ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(email)

    await page.getByRole('button', { name: 'Add address' }).click()
    await page.getByLabel('Address 1 city').fill('Paris')
    // Added, then thought better of it.
    await page.getByRole('button', { name: 'Add address' }).click()

    await page.getByRole('button', { name: 'Create contact' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: fullName }),
    ).toBeVisible()
    await expect(page.locator('dd', { hasText: 'Paris' }).first()).toContainText('Paris')

    await page.getByRole('button', { name: `Delete ${fullName}` }).click()
    await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
    await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
  })
})
