import { test, expect } from '@playwright/test'

/** The download only really exists in a browser, headers and all. */

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

test('downloads a contact as a vCard carrying every address', async ({ page }) => {
  const email = uniqueEmail('vcard')
  const last = `Vcard${Date.now().toString().slice(-6)}`
  const fullName = `Ada ${last}`

  await page.goto('/contacts/new')
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill(last)
  await page.getByLabel('Email', { exact: false }).first().fill(email)

  await page.getByRole('button', { name: 'Add address' }).click()
  await page.getByLabel('Address 1 type').selectOption('Work')
  await page.getByLabel('Address 1 city').fill('San Francisco')

  await page.getByRole('button', { name: 'Add address' }).click()
  await page.getByLabel('Address 2 type').selectOption('Home')
  await page.getByLabel('Address 2 city').fill('London')

  await page.getByRole('button', { name: 'Create contact' }).click()
  await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'vCard', exact: true }).click(),
  ])

  expect(download.suggestedFilename()).toBe(`ada-${last.toLowerCase()}.vcf`)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const vcard = Buffer.concat(chunks).toString('utf8')

  expect(vcard).toContain('BEGIN:VCARD')
  expect(vcard).toContain('VERSION:3.0')
  expect(vcard).toContain(`FN:${fullName}`)
  // Both addresses, each under its own type.
  expect(vcard).toContain('ADR;TYPE=WORK:;;;San Francisco;;;')
  expect(vcard).toContain('ADR;TYPE=HOME:;;;London;;;')
  expect(vcard.trimEnd().endsWith('END:VCARD')).toBe(true)

  await page.getByRole('button', { name: `Delete ${fullName}` }).click()
  await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
})
