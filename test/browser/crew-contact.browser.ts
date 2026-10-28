import { expect, test } from '@playwright/test';
import { newGame } from '../../src/sim/kitchen.ts';

for (const [width, height] of [
  [360, 690],
  [1280, 800],
  [820, 1180],
  [1180, 820],
] as const) {
  test(`ordinary crew contact remains readable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.clock.install();
    const legacy = newGame(42, 'pass@13');
    await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
      game: legacy.version,
      plainNarration: true,
      seed: legacy.seed,
      inputs: legacy.inputs,
      minute: legacy.minute,
      pages: [],
    });
    await page.goto('/');
    await page.locator('#cont').click();
    await page.locator('#open-service').click();
    await page.locator('[data-pick="selim"]').click();
    const button = page.locator('[data-contact="check-in"]');
    await expect(button).toBeEnabled();
    const bounds = await button.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect((bounds?.y ?? height) + (bounds?.height ?? 0)).toBeLessThanOrEqual(height);
    const before = await page.evaluate(() => {
      const s = Reflect.get(window, '__pass').state;
      return {
        minute: s.minute,
        people: JSON.stringify(s.people),
        caption: document.querySelector('#caption')?.textContent,
      };
    });
    await button.click();
    await expect(page.locator('.journal')).toContainText('How are you doing, Selim?');
    await expect(page.locator('.journal')).toContainText('working at the grill');
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, '__pass').state.people))).toBe(
      before.people,
    );
    await expect(page.locator('#caption')).toHaveText(before.caption ?? '');
    await page.clock.runFor(1500);
    expect(await page.evaluate(() => Reflect.get(window, '__pass').state.minute)).toBe(before.minute);
    await page.locator('[data-pick="selim"]').click();
    await expect(page.locator('[data-contact="check-in"]')).toBeDisabled();
    await page.locator('[data-contact="follow-up"]').click();
    await expect(page.locator('.journal')).toContainText('Thank you for listening, Chef.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
