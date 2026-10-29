import { expect, test } from '@playwright/test';

for (const [width, height] of [
  [360, 690],
  [820, 1180],
  [1180, 820],
  [1280, 800],
] as const) {
  test(`HF4.12 saves and resumes at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.addInitScript(() => localStorage.setItem('hf-lab-recording', 'off'));
    await page.goto('/');
    await page.locator('#new').click();
    await expect(page.locator('#open-service')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const request = indexedDB.open('pass-journal');
              request.onsuccess = () => {
                const tx = request.result.transaction('head', 'readonly');
                const get = tx.objectStore('head').get('current');
                get.onsuccess = () => resolve(!!get.result);
                get.onerror = () => resolve(false);
              };
              request.onerror = () => resolve(false);
            }),
        ),
      )
      .toBe(true);
    await page.reload();
    await expect(page.locator('#cont')).toBeVisible();
    await page.locator('#cont').click();
    await expect(page.locator('#open-service')).toBeVisible();
    const saved = await page.evaluate(
      () =>
        new Promise<{ host: { framework: string }; opening: unknown }>((resolve, reject) => {
          const request = indexedDB.open('pass-journal');
          request.onsuccess = () => {
            const tx = request.result.transaction('head', 'readonly');
            const get = tx.objectStore('head').get('current');
            get.onsuccess = () => resolve(get.result);
            get.onerror = () => reject(get.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
    expect(saved.host.framework).toBe('4.12.0');
    expect(saved.opening).toBeTruthy();
    await page.locator('#people').click();
    const condition = page.getByRole('region', { name: 'My current condition' });
    await expect(condition).toContainText('I feel');
    expect(await condition.textContent()).not.toMatch(/[0-9]|valence|arousal|successRate/);
    await page.locator('#people-close').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('an old native save stays stored and asks for a fresh start', async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => localStorage.setItem('pass-save', '{"format":2,"framework":"4.8.1"}'));
  await page.goto('/');
  await expect(page.getByText('Your old saved game cannot be opened.', { exact: false })).toBeVisible();
  await expect(page.locator('#cont')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pass-save'))).toBe(
    '{"format":2,"framework":"4.8.1"}',
  );
});

test('an aborted IndexedDB save preserves the previous head and can be retried', async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => localStorage.setItem('hf-lab-recording', 'off'));
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('#open-service')).toBeVisible();
  const readHead = () =>
    page.evaluate(
      () =>
        new Promise<string | null>((resolve, reject) => {
          const request = indexedDB.open('pass-journal');
          request.onsuccess = () => {
            const tx = request.result.transaction('head', 'readonly');
            const get = tx.objectStore('head').get('current');
            get.onsuccess = () => resolve(get.result ? JSON.stringify(get.result) : null);
            get.onerror = () => reject(get.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await expect.poll(readHead).not.toBeNull();
  const before = await readHead();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args);
      if (args[1] === 'readwrite') {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
  });
  await page.locator('#game-menu').click();
  await expect(page.locator('#save-result')).toContainText('could not save');
  expect(await readHead()).toBe(before);
  await page.locator('#menu-back').click();
  await page.locator('#game-menu').click();
  await expect(page.locator('#save-result')).toContainText('The game is saved');
  await page.locator('#menu-back').click();
  await page.reload();
  await expect(page.locator('#cont')).toBeVisible();
  await page.locator('#cont').click();
  await expect(page.locator('#open-service')).toBeVisible();
});
