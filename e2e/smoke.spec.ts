import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

// A tiny 2×1 PNG: one red pixel, one green pixel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DAwMAAAA0BAf+1XkUzAAAAAElFTkSuQmCC', 'base64');

test('simulate images and check a palette', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('through other eyes');
  await page.waitForTimeout(1200);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Simulate an image' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Simulate');
  await page.getByLabel('Image', { exact: true }).selectOption('map');
  // The simulated deuteranopia canvas should differ from the original.
  await expect.poll(() => page.evaluate(() => {
    const [orig, , deut] = [...document.querySelectorAll<HTMLCanvasElement>('.sim canvas')];
    if (!orig?.width || !deut?.width) return false;
    const a = orig.getContext('2d')!.getImageData(80, 80, 1, 1).data, b = deut.getContext('2d')!.getImageData(80, 80, 1, 1).data;
    return a[3] > 0 && (a[0] !== b[0] || a[1] !== b[1]);
  })).toBe(true);
  await snap(page, 'image');
  await checkMobile(page, 'image-mobile');

  await page.getByRole('radio', { name: 'One type, adjustable' }).click();
  await page.getByLabel(/Severity/).fill('0.5');
  await expect(page.getByRole('img', { name: /at 50%/ })).toBeVisible();
  await page.getByLabel('Upload image').setInputFiles({ name: 'dots.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByLabel('Image', { exact: true })).toHaveValue('upload');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  expect((await dl).suggestedFilename()).toBe('simulated-deutan-50.png');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Palette' }).click();
  await expect(page.getByTestId('flagged')).toContainText('hard to tell apart');
  await page.getByLabel('Add colours').fill('#17becf');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: /#17becf/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('columnheader', { name: /#17becf/ })).toBeVisible();
  await snap(page, 'palette');
  await checkMobile(page);
});
