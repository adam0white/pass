import { expect, test } from '@playwright/test';
import { required } from '../../src/required.ts';

test.beforeEach(async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.clock.install();
  await page.goto('/?lab=1');
});

test('new log lines highlight temporarily while the situation stays visible', async ({ page }) => {
  await page.locator('#fresh-authored').click();
  await page.locator('#open-service').click();
  const status = await page.locator('#caption').textContent();
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.lastAnswer = {
      at: app.state.minute,
      who: 'selim',
      verb: 'cold',
      verdict: 'assented',
      text: 'Yes, I will work there.',
    };
    app.state.said.push({
      at: app.state.minute,
      who: 'selim',
      kind: 'answer',
      text: 'Yes, I will work there.',
    });
    app.draw();
  });
  await expect(page.locator('#caption')).toHaveText(required(status));
  await expect(page.locator('.journal .new-log-line').last()).toContainText('Yes, I will work there.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.new-log-line')
      .last()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  await page.clock.runFor(4500);
  await expect(page.locator('.new-log-line')).toHaveCount(0);
});

for (const [width, height] of [
  [360, 690],
  [1280, 800],
]) {
  test(`promise answer keeps panel scroll and disappears after reading at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: required(width), height: required(height) });
    await page.locator('#other-ways').click();
    // Pin the ordinary start to writer/Hasan and measure only after the rendered fonts settle.
    await page.clock.setFixedTime(new Date(7));
    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await page.getByRole('button', { name: 'Begin at the second week', exact: true }).click();
    await expect(page.locator('.sunday-page')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const promises = page.locator('.party-card [data-val="promise"]');
    const button = width === 360 ? promises.first() : promises.last();
    await button.scrollIntoViewIfNeeded();
    const before = await page.locator('.sunday-page > .page-body').evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);
    await button.click();
    expect(await page.locator('.sunday-page > .page-body').evaluate((el) => el.scrollTop)).toBeCloseTo(
      before,
      0,
    );
    await expect(page.locator('.party-card .chosen')).toHaveText('Promise it');
    await page.clock.runFor(4500);
    await expect(page.locator('.party-card .chosen')).toHaveCount(0);
    await expect(page.locator('.party-card')).toHaveCount(1);
    await expect(page.locator('.party-jumps')).not.toContainText(': and');
    await page.locator('.party-card [data-val="plain"]').click();
    await expect(page.locator('.party-card .chosen')).toHaveText('No promise');
    await page.reload();
    await page.locator('#cont').click();
    await expect(page.locator('.party-card, .party-jumps')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
