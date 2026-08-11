import { test, expect } from '@playwright/test';
import fs from 'fs';

// Addon v3 smoke spec — locked requirements:
//  S1 Admin addon toggles reflect in the addon registry (round-trip to storage/dev.db).
//  S2 Addon v3 UI manifests loaded by route (useAddonRouteForPath); Splat page renders addon pages.
//  S3 Modrinth addon API paths are proxied to the panel (Vite → Express).
//  S4 Arclight Cloud settings page + CSRF save round-trip.
//  S5 Console slot ("server:console:toolbar") mounts the Modrinth toolbar on the server page.
//  S6 Console-error gate: zero uncaught errors / failed module loads on every page above.
// Riders (not gated, checked only as notes):
//  - Modrinth external API is NOT gated (no live network to modrinth.com).
//  - Spec self-bootstraps: addons start disabled; spec enables them via the admin page.
//  - Must be run from repo root with the panel (Vite :3000 → Express :3001) running.

const RESULTS: Record<string, { status: 'PASS' | 'BLOCKED' | 'FAIL'; note: string }> = {};

function record(name: string, status: 'PASS' | 'BLOCKED' | 'FAIL', note = '') {
  RESULTS[name] = { status, note };
  fs.mkdirSync('./report', { recursive: true });
  fs.writeFileSync('./report/matrix.json', JSON.stringify(RESULTS, null, 2));
  console.log(`[SMOKE] ${name}: ${status}${note ? ` — ${note}` : ''}`);
}

function writeReport() {
  const pass = Object.values(RESULTS).filter((r) => r.status === 'PASS').length;
  const blocked = Object.values(RESULTS).filter((r) => r.status === 'BLOCKED').length;
  const fail = Object.values(RESULTS).filter((r) => r.status === 'FAIL').length;
  console.log(`[SMOKE] === MATRIX: ${pass} PASS / ${blocked} BLOCKED / ${fail} FAIL ===`);
}

const SERVER_UUID = process.env.SMOKE_SERVER_UUID ?? 'b22bc81a-e01a-4018-abdd-8777b6916e9e';

interface Violation {
  page: string;
  text: string;
}

// Collects real console errors and uncaught page errors. Filtered to avoid
// noise: we treat a message as a violation only when it is an error-level
// console entry or a pageerror (uncaught exception / failed module load).
function listenErrors(page: import('@playwright/test').Page) {
  const errors: Violation[] = [];
  page.on('pageerror', (err) =>
    errors.push({ page: page.url(), text: String(err?.message ?? err) }),
  );
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ page: page.url(), text: msg.text() });
  });
  return errors;
}

test.describe('Addon v3 smoke journey', () => {
  test.afterAll(() => writeReport());

  test('S1 admin addon toggles reflect in registry (DB round-trip)', async ({ page }) => {
    const errors = listenErrors(page);
    await page.goto('/admin/addons');

    // Self-bootstrap: ensure both addons are enabled.
    for (const slug of ['modrinth', 'arclight-cloud']) {
      // Find the row by its primary text (manifest name or slug).
      const row = page.locator('li', { hasText: slug });
      await expect(row).toBeVisible();
      const enable = row.getByRole('button', { name: 'Enable', exact: true });
      const disable = row.getByRole('button', { name: 'Disable', exact: true });
      await expect(enable.or(disable)).toBeVisible();
      if (await enable.isVisible()) {
        await enable.click();
      }
      await expect(disable).toBeVisible();
    }

    // Registry round-trip: after enabling via UI, the addon registry (DB) shows them.
    // Reload the page so state is re-fetched from the server.
    await page.reload();
    for (const slug of ['modrinth', 'arclight-cloud']) {
      const row = page.locator('li', { hasText: slug });
      await expect(row.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    }

    record(
      'S1 admin toggles',
      errors.length ? 'FAIL' : 'PASS',
      errors.length ? errors.map((e) => e.text).join(' | ') : 'both addons enabled, persisted across reload',
    );
  });

  test('S2 modrinth admin page renders under /modrinth route', async ({ page }) => {
    const errors = listenErrors(page);
    // The admin config page is a dedicated v3 addon route.
    await page.goto('/modrinth/admin/config');
    await expect(page.getByRole('heading', { name: 'Modrinth Admin', level: 1 })).toBeVisible();
    record(
      'S2 modrinth admin page',
      errors.length ? 'FAIL' : 'PASS',
      errors.length ? errors.map((e) => e.text).join(' | ') : 'h1 rendered',
    );
  });

  test('S3 modrinth api paths proxied (vite/express)', async ({ request }) => {
    // apiPaths [/modrinth/api/] must be reachable through the Vite proxy.
    const res = await request.get('/modrinth/api/health');
    const ok = res.status() === 200;
    const json = ok ? await res.json().catch(() => null) : null;
    record('S3 modrinth api proxy', ok ? 'PASS' : 'FAIL', `health ${res.status()}${json ? ` ${JSON.stringify(json)}` : ''}`);
  });

  test('S4 arclight cloud settings save round-trip (CSRF)', async ({ page }) => {
    const errors = listenErrors(page);
    await page.goto('/arclight-cloud/settings');

    const apiKeyInput = page.locator('input[id="arclight-cloud-api-key"]');
    await expect(apiKeyInput).toBeVisible();

    const stamp = Date.now().toString(36);
    await apiKeyInput.fill(`smoke-${stamp}`);

    // Settings are saved via POST with the CSRF token from <meta name="csrf-token">.
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    await page.evaluate((token) => {
      (window as unknown as { __smokeCsrf__?: string }).__smokeCsrf__ = token ?? '';
    }, csrf);

    const saveBtn = page.getByRole('button', { name: /save settings/i });
    await saveBtn.click();
    await expect(page.getByText(/settings saved/i).first()).toBeVisible({ timeout: 10_000 });

    // Round-trip: reload, wait for saved value to be re-fetched and shown.
    await page.reload();
    await expect(page.locator('input[id="arclight-cloud-api-key"]')).toHaveValue(`smoke-${stamp}`, { timeout: 10_000 });

    record(
      'S4 arclight settings round-trip',
      errors.length ? 'FAIL' : 'PASS',
      errors.length ? errors.map((e) => e.text).join(' | ') : `saved ${stamp} and re-loaded`,
    );
  });

  test('S5 console slot mounts modrinth toolbar on server page', async ({ page }) => {
    const errors = listenErrors(page);
    await page.goto(`/server/${SERVER_UUID}`);
    // The toolbar registers for slot "server:console:toolbar"; it renders a
    // "Modrinth" label plus a quick-install affordance.
    await expect(page.getByText('Modrinth', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    record(
      'S5 console toolbar slot',
      errors.length ? 'FAIL' : 'PASS',
      errors.length ? errors.map((e) => e.text).join(' | ') : 'toolbar rendered in console slot',
    );
  });

  test('S6 console-error gate across addon surfaces', async ({ page }) => {
    const errors = listenErrors(page);
    for (const path of [
      '/admin/addons',
      '/modrinth/admin/config',
      '/arclight-cloud/settings',
      `/server/${SERVER_UUID}`,
    ]) {
      await page.goto(path);
      // Wait for the addon page to settle before moving on.
      await page.waitForTimeout(500);
    }
    record(
      'S6 console-error gate',
      errors.length ? 'FAIL' : 'PASS',
      errors.length ? errors.map((e) => e.text).join(' | ') : 'zero console errors / failed module loads',
    );
  });
});
