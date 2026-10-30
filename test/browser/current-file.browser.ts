import { readFile, writeFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { validateReplayFile } from '../../src/sim/continuation.ts';
import { cloneState } from '../../src/sim/kitchen.ts';

async function menu(page: Page) {
  await page.locator('#game-menu').click();
  await page.getByText('Debug', { exact: true }).click();
}
async function copy(page: Page, path: string) {
  const pending = page.waitForEvent('download');
  await page.locator('#debug-export').click();
  await (await pending).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}
async function chooseFile(page: Page, path: string) {
  const pending = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await (await pending).setFiles(path);
}
async function nativeBytes(page: Page) {
  return page.evaluate(async () => {
    const result: Record<string, unknown> = {};
    for (const item of await indexedDB.databases()) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(item.name as string);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const stores: Record<string, unknown> = {};
      for (const name of db.objectStoreNames)
        stores[name] = await new Promise((resolve, reject) => {
          const request = db.transaction(name, 'readonly').objectStore(name).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      db.close();
      result[item.name as string] = stores;
    }
    return JSON.stringify(result);
  });
}

for (const [width, height] of [
  [360, 690],
  [1280, 800],
] as const) {
  test(`current files survive public input and reload at ${width}x${height}`, async ({ page }, info) => {
    test.setTimeout(90000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => localStorage.setItem('hf-lab-recording-off', '1'));
    await page.goto('/');
    await page.locator('#new').click();
    await page.locator('#open-service').click();
    await page.waitForTimeout(6500);
    await page.locator('#people').click();
    await page.getByRole('button', { name: 'Talk with Selim another time', exact: true }).click();
    await menu(page);
    const before = await copy(page, info.outputPath('native.json'));
    await page.reload();
    await page.locator('#cont').click();
    await menu(page);
    await page.locator('#debug-verify').click();
    await expect(page.locator('#debug-result')).toHaveText('The replay matches this game.');
    await page.waitForFunction(() =>
      document.querySelector('#save-result')?.textContent?.includes('saved and paused'),
    );
    const original = await nativeBytes(page);
    await chooseFile(page, info.outputPath('native.json'));
    await page.locator('#title-confirm-yes').click();
    await expect(page.locator('.run-status')).toContainText('matches the saved game');
    await menu(page);
    const imported = await copy(page, info.outputPath('imported.json'));
    expect(imported.continuity.fileOrigin).toBe(true);
    expect(imported.continuity.ownedHeads).toEqual({});
    expect(imported.state).toEqual(before.state);
    expect(await nativeBytes(page)).toBe(original);
    await page.locator('#menu-back').click();
    await page.waitForTimeout(1500);
    await page.locator('#people').click();
    await page.getByRole('button', { name: 'Talk with Selim another time', exact: true }).click();
    await menu(page);
    const next = await copy(page, info.outputPath('next.json'));
    expect(next.inputs.length).toBeGreaterThan(before.inputs.length);
    const replayed = cloneState(await validateReplayFile(next));
    expect(replayed).toEqual(next.state);
    expect(replayed.hf4).toEqual(next.state.hf4);
    expect(await nativeBytes(page)).toBe(original);
    for (const kind of ['host', 'hf']) {
      const corrupt = structuredClone(next);
      if (kind === 'host') corrupt.state.till += 1;
      else corrupt.state.hf4.archive.current.at += 1;
      const path = info.outputPath(`corrupt-${kind}.json`);
      await writeFile(path, JSON.stringify(corrupt));
      await chooseFile(page, path);
      await expect(page.locator('#title-status')).toContainText('Keep the original file');
      expect(await nativeBytes(page)).toBe(original);
      await menu(page);
      const still = await copy(page, info.outputPath(`after-${kind}.json`));
      expect(still.state).toEqual(next.state);
    }
    expect(pageErrors).toEqual([]);
  });
}

test('expired speech highlight leaves the file chooser title intact', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('hf-lab-recording-off', '1'));
  await page.goto('/');
  await page.locator('#new').click();
  await page.locator('#open-service').click();
  await expect(page.locator('.new-log-line').first()).toBeVisible();
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
  await menu(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#debug-import').click();
  await chooser;
  await expect(page.locator('#sheet')).toHaveCount(0);
  await page.clock.runFor(4000);
  await expect(page.locator('#new')).toBeVisible();
  await expect(page.locator('#sheet')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
