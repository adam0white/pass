import { expect, test } from '@playwright/test';

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
  await expect(page.locator('.board-summary').first()).toContainText('Meal break:');
  await expect(page.locator('.board-answer').first()).toContainText('20-minute meal break');
  await expect(page.locator('.people-board')).not.toContainText('minutes for a plate');
  await page.locator('#people').click();
  await expect(page.getByRole('dialog', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'People', exact: true })).toContainText('optional');
  await page.locator('#people-close').click();
  await page.locator('#game-menu').click();
  await expect(page.locator('.game-menu-dialog')).not.toContainText('kitchen stint');
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}
