import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const fixture = (name: string) => path.join(process.cwd(), 'tests', 'fixtures', name);

async function openFixture(page: Page, name: string) {
  await page.getByTestId('file-input').setInputFiles(fixture(name));
  await expect(page.locator('.status-file__name')).toHaveText(name);
  await expect(page.getByTestId('original-preview')).toBeVisible();
  await expect(page.getByTestId('vector-preview')).toHaveCount(0);
}

async function trace(page: Page) {
  await page.getByTestId('trace-button').click();
  await expect(page.getByTestId('vector-preview')).toBeVisible({ timeout: 70_000 });
  await expect(page.getByTestId('job-status')).toContainText('Bereit');
  await expect(page.getByTestId('stale-badge')).toHaveCount(0);
}

test('loads the sample, compares views, undoes changes and exports SVG and PNG', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: 'Rasterbild in Vektoren umwandeln' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Beispielbild ausprobieren' }).click();
  await expect(page.locator('.status-file__name')).toHaveText('beispiel-logo.png');
  await trace(page);

  const handle = page.getByTestId('compare-handle');
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute('aria-valuenow', '50');
  await handle.focus();
  await handle.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '52');

  await expect(page.getByTestId('original-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Vektor', exact: true }).click();
  await expect(page.getByTestId('original-preview')).toHaveCount(0);
  await expect(page.getByTestId('vector-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Vergleich', exact: true }).click();

  const smoothing = page.locator('#smoothing');
  await expect(smoothing).toHaveValue('4');
  await smoothing.focus();
  await smoothing.press('End');
  await expect(smoothing).toHaveValue('10');
  await expect(page.getByTestId('stale-badge')).toBeVisible();

  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(smoothing).toHaveValue('4');
  await expect(page.getByTestId('stale-badge')).toHaveCount(0);

  await page.getByRole('button', { name: /Wiederholen/ }).click();
  await expect(smoothing).toHaveValue('10');
  await expect(page.getByTestId('stale-badge')).toBeVisible();
  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(page.getByTestId('stale-badge')).toHaveCount(0);

  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exportieren' });
  await expect(dialog).toBeVisible();

  const svgDownloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'SVG herunterladen' }).click();
  const svgDownload = await svgDownloadEvent;
  expect(svgDownload.suggestedFilename()).toBe('beispiel-logo-vektor.svg');
  const svgPath = await svgDownload.path();
  expect(svgPath).not.toBeNull();
  const svg = readFileSync(svgPath!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('viewBox="0 0 640 640"');
  expect(svg).toContain('<path');
  expect(svg).not.toContain('<image');
  expect(svg).not.toContain('<foreignObject');

  await dialog.getByRole('button', { name: 'PNG', exact: true }).click();
  await dialog.locator('#png-width').fill('320');
  await expect(dialog.getByText('320 × 320 px')).toBeVisible();
  const pngDownloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'PNG herunterladen' }).click();
  const pngDownload = await pngDownloadEvent;
  expect(pngDownload.suggestedFilename()).toBe('beispiel-logo-vektor.png');
  const pngPath = await pngDownload.path();
  expect(pngPath).not.toBeNull();
  const png = readFileSync(pngPath!);
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.length).toBeGreaterThan(100);

  await dialog.getByRole('button', { name: 'Schließen', exact: true }).first().click();
  await expect(dialog).toBeHidden();

  expect(errors).toEqual([]);
});

test('traces transparent, black-and-white and colour artwork', async ({ page }) => {
  await page.goto('./');

  await openFixture(page, 'logo-transparent.png');
  const logoPreset = page.locator('.preset-row').getByRole('button', { name: 'Logo' });
  await logoPreset.click();
  await expect(logoPreset).toHaveAttribute('aria-pressed', 'true');
  await trace(page);

  const logoFills = await page
    .getByTestId('vector-preview')
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
  expect(logoFills.length).toBeGreaterThanOrEqual(2);
  expect(new Set(logoFills).size).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('vector-preview').locator('rect')).toHaveCount(0);

  await openFixture(page, 'symbol-bw.png');
  const bwPreset = page.locator('.preset-row').getByRole('button', { name: 'Schwarz-Weiß' });
  await bwPreset.click();
  await expect(bwPreset).toHaveAttribute('aria-pressed', 'true');
  await trace(page);

  const bwFills = await page
    .getByTestId('vector-preview')
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
  expect(bwFills.length).toBeGreaterThan(0);
  for (const fill of bwFills) {
    expect(['#000000', '#ffffff']).toContain(fill);
  }

  await openFixture(page, 'illustration-color.png');
  const illustrationPreset = page
    .locator('.preset-row')
    .getByRole('button', { name: 'Illustration' });
  await illustrationPreset.click();
  await expect(illustrationPreset).toHaveAttribute('aria-pressed', 'true');
  await trace(page);

  const colourFills = await page
    .getByTestId('vector-preview')
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
  expect(colourFills.length).toBeGreaterThan(5);
  expect(new Set(colourFills).size).toBeGreaterThanOrEqual(5);
});

test('rejects corrupt and unsupported files without losing the session', async ({ page }) => {
  await page.goto('./');

  await page.getByTestId('file-input').setInputFiles(fixture('invalid.png'));
  await expect(page.getByRole('alert')).toContainText(/konnte nicht gelesen werden/);
  await expect(
    page.getByRole('heading', { name: 'Rasterbild in Vektoren umwandeln' }),
  ).toBeVisible();

  await page.getByTestId('file-input').setInputFiles({
    name: 'notizen.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('kein Bild', 'utf8'),
  });
  await expect(page.getByRole('alert').filter({ hasText: /Dateityp/ })).toBeVisible();

  await page.getByTestId('file-input').setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8'),
  });
  await expect(
    page.getByRole('alert').filter({ hasText: /bereits vektoriell/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Beispielbild ausprobieren' }).click();
  await expect(page.getByTestId('original-preview')).toBeVisible();
  await expect(page.locator('.status-file__name')).toHaveText('beispiel-logo.png');
});

test('debounces automatic updates and cancels a long original-resolution trace', async ({
  page,
}) => {
  await page.goto('./');
  await openFixture(page, 'large.png');

  const resolution = page.locator('#working-resolution');
  await expect(resolution).toHaveValue('2400');
  await expect(page.locator('.sidebar').getByText(/2400 × 1500 px/)).toBeVisible();

  await resolution.selectOption('1200');
  await expect(page.locator('.sidebar').getByText(/1200 × 750 px/)).toBeVisible();

  const autoTrace = page.getByRole('checkbox', { name: /Automatisch aktualisieren/ });
  await autoTrace.check();
  await expect(page.getByTestId('vector-preview')).toBeVisible({ timeout: 70_000 });
  await expect(page.getByTestId('job-status')).toContainText('Bereit');

  const smoothing = page.locator('#smoothing');
  await smoothing.focus();
  await smoothing.press('End');
  await smoothing.press('Home');
  await expect(smoothing).toHaveValue('0.5');

  await expect(page.getByTestId('job-status')).toContainText('Bereit', { timeout: 70_000 });
  await expect(page.getByTestId('stale-badge')).toHaveCount(0);
  await expect(page.locator('.preset-description')).toHaveText('Eigene Werte');
  await expect(page.getByTestId('vector-preview')).toBeVisible();

  await autoTrace.uncheck();
  await resolution.selectOption('0');
  await smoothing.focus();
  await smoothing.press('End');
  await expect(page.getByTestId('stale-badge')).toBeVisible();

  await page.getByTestId('trace-button').click();
  await page.getByTestId('cancel-button').click();
  await expect(page.getByText('Vektorisierung abgebrochen.')).toBeVisible();
  await expect(page.getByTestId('trace-button')).toBeVisible();
  await expect(page.getByTestId('vector-preview')).toBeVisible();
});
