import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function quietNetwork(page: import('@playwright/test').Page) {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
}

test('player title and menu hide lab tools; lab URL retains them', async ({ page }) => {
  await quietNetwork(page);
  await page.goto('/');
  await expect(page.locator('#fresh-authored, #other-ways, #load, #file, .start-approaches')).toHaveCount(0);
  await page.locator('#game-menu').click();
  const menu = page.getByRole('dialog', { name: 'Game menu', exact: true });
  await expect(menu.getByRole('button', { name: 'Feedback', exact: true })).toBeVisible();
  await expect(menu.getByRole('checkbox')).toHaveCount(1);
  await expect(menu).not.toContainText(/continuity|Download|accepted person/i);
  await menu.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(menu.locator('#menu-new-confirm')).toBeVisible();
  await menu.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(menu.locator('#menu-new-confirm')).toBeHidden();
  await menu.getByRole('button', { name: 'New game', exact: true }).click();
  await menu.locator('#menu-new-yes').click();
  await expect(page.locator('.people-board')).toBeVisible();
  await page.goto('/?lab=1');
  await page.locator('#other-ways').click();
  await expect(page.locator('#load')).toBeVisible();
});

test('ordinary local new game keeps meaningful people actions outside the menu', async ({ page }) => {
  await quietNetwork(page);
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('.people-board')).toBeVisible();
  await expect(page.locator('.board-summary').first()).toContainText('The meal break is at');
  await expect(page.locator('.board-answer').first()).toContainText('twenty-minute meal break');
  await expect(page.locator('.people-board')).not.toContainText('minutes for a plate');
  await page.locator('#people').click();
  await expect(page.getByRole('dialog', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'People', exact: true })).toContainText('You do not have to');
  await page.locator('#people-close').click();
  await page.locator('#game-menu').click();
  await expect(page.locator('.game-menu-dialog')).not.toContainText('time working in the kitchen');
  await page.locator('#send-run').click();
  await expect(page.locator('.pass-feedback h1')).toHaveText('Feedback');
  await expect(page.locator('.pass-feedback textarea')).toBeVisible();
  await expect(page.locator('.pass-feedback .feedback-send')).toBeVisible();
});

for (const [width, height] of [
  [360, 690],
  [820, 1180],
  [1180, 820],
  [1280, 800],
]) {
  test(`readable board and service at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await quietNetwork(page);
    await page.goto('/');
    await page.locator('#new').click();
    await expect(page.locator('.people-board')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width! >= 768) {
      expect(
        await page
          .locator('.board-summary')
          .first()
          .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(17);
    }
    await page.locator('#open-service').click();
    await expect(page.locator('.people-service')).toBeVisible();
    await page.locator('[data-pick="selim"]').click();
    await expect(page.locator('.verbs button').first()).toBeVisible();
    await expect(page.locator('.verbs')).toContainText('10-minute break');
    expect(await page.locator('.panel-reply').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}

test('recording notice stays in the footer and appears once per local origin', async ({ page }) => {
  await quietNetwork(page);
  await page.goto('/');
  const notice = page.locator('#recording-footer .lk-telemetry-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText('We record and link play across games on this device.');
  expect(await notice.evaluate((el) => getComputedStyle(el).position)).toBe('static');
  await expect(notice.locator('button')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await notice.evaluate((el) => {
    const style = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    return {
      font: Number.parseFloat(style.fontSize),
      width: el.getBoundingClientRect().width,
      rects: [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
      lines: range.getClientRects().length,
      height: el.getBoundingClientRect().height,
      wrapper: el.parentElement!.getBoundingClientRect().height,
    };
  });
  console.log('Footer metrics', metrics);
  expect(metrics.font).toBeGreaterThanOrEqual(14);
  expect(metrics.lines).toBe(1);
  expect(metrics.height).toBeLessThanOrEqual(40);
  expect(metrics.wrapper).toBeLessThanOrEqual(40);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const enlarged = await notice.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    scroll: el.scrollHeight,
    client: el.clientHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(enlarged.height).toBeGreaterThan(metrics.height);
  expect(enlarged.scroll).toBeLessThanOrEqual(enlarged.client + 1);
  expect(enlarged.overflow).toBe(false);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.locator('#new').click();
  await expect(page.locator('.people-board')).toBeVisible();
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.reload();
  await expect(page.locator('.lk-telemetry-notice')).toHaveCount(0);
});

test('failed admission keeps the save and hides technical details outside lab tools', async ({ page }) => {
  await quietNetwork(page);
  await page.goto('/');
  await page.locator('#new').click();
  await expect(page.locator('.people-board')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('pass-save-v3'));
  expect(saved).toBeTruthy();
  // Exercise the UI's rejected-admission path. The real claim/rollback is covered in continuity.test.
  await page.route('**/src/ui/continuity.ts*', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const injected = body.replace(
      /async function fresh\(seed\) \{/,
      'async function fresh(seed) { throw new Error("Shelf unavailable. Use a local file.");',
    );
    expect(injected).not.toBe(body);
    await route.fulfill({ response, body: injected });
  });
  await page.reload();
  await page.locator('#new').click();
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('#title-status')).toContainText('Your saved game is safe.');
  await expect(page.locator('#title-status')).toContainText('Feedback');
  await expect(page.locator('#title-status')).not.toContainText('Shelf unavailable');
  expect(await page.evaluate(() => localStorage.getItem('pass-save-v3'))).toBe(saved);
  await page.locator('#game-menu').click();
  await page.locator('#menu-new').click();
  await page.locator('#menu-new-yes').click();
  await expect(page.locator('#save-result')).toContainText('Your current game is safe.');
  await expect(page.locator('#save-result')).not.toContainText('Shelf unavailable');
  expect(await page.evaluate(() => localStorage.getItem('pass-save-v3'))).toBe(saved);
  await page.goto('/?lab=1');
  await page.locator('#new').click();
  await page.locator('#title-confirm-yes').click();
  await expect(page.locator('#title-status')).toContainText('Shelf unavailable. Use a local file.');
});
