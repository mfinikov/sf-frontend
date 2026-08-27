import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * The photo path cannot be covered by the unit tests: resizing runs on a real
 * canvas, and the edit form's full-replace `PUT` only bites in a real browser.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'avatar.png')

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

test.describe('Contact photo', () => {
  test('uploads, shows a circular avatar, and survives an edit', async ({ page }) => {
    const email = uniqueEmail('photo')
    const last = `Photo${Date.now().toString().slice(-6)}`
    const fullName = `Ada ${last}`

    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill(last)
    await page.getByLabel('Email', { exact: false }).first().fill(email)

    await page.getByLabel('Profile photo').setInputFiles(FIXTURE)

    // The browser re-encodes as JPEG, so the preview proves the resize ran.
    const preview = page.getByAltText('Selected profile photo')
    await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,/)

    await page.getByRole('button', { name: 'Create contact' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: fullName }),
    ).toBeVisible()

    const avatar = page.locator('img[src^="data:image/jpeg"]').first()
    await expect(avatar).toBeVisible()
    await expect(avatar).toHaveClass(/rounded-full/)
    await expect(avatar).toHaveClass(/object-cover/)

    // Centre-cropped to a square, so the circle never squashes a face.
    const box = await avatar.boundingBox()
    expect(box?.width).toBeCloseTo(box?.height ?? 0, 0)

    // The edit form does a full-replace PUT. Saving without touching the picker
    // must not clear the photo.
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByLabel('Job title').fill('Mathematician')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Mathematician').first()).toBeVisible()
    await expect(page.locator('img[src^="data:image/jpeg"]').first()).toBeVisible()

    // Removing the photo falls back to initials.
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Remove photo' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(0)
    await expect(page.getByText(`A${last.at(0)}`, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: `Delete ${fullName}` }).click()
    await page.getByRole('button', { name: `Confirm deleting ${fullName}` }).click()
    // Wait for the redirect, or the test ends before the delete lands and the
    // contact is left behind for the next run.
    await expect(page).toHaveURL(/\/contacts\/?(\?.*)?$/)
  })

  test('rejects a file that is not an allowed image', async ({ page }) => {
    await page.goto('/contacts/new')

    await page.getByLabel('Profile photo').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    })

    await expect(page.getByText(/JPEG, PNG, GIF, or WebP image/i)).toBeVisible()
    await expect(page.getByAltText('Selected profile photo')).toHaveCount(0)
  })
})
