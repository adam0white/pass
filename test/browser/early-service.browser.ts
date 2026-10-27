import { expect, test } from '@playwright/test';
import { newGame, queueInput, step } from '../../src/sim/kitchen.ts';

test.setTimeout(120000);

import { openingBoard } from '../../src/ui/board.ts';

for (const [width, height] of [
  [360, 690],
  [820, 1180],
  [1180, 820],
  [1280, 800],
] as const) {
  test(`waiting order and lost payment remain on the board at ${width}x${height}`, async ({ page }) => {
    const s = newGame(42, 'pass@18');
    queueInput(s, { kind: 'board', rows: openingBoard(s) });
    queueInput(s, { kind: 'open' });
    while (s.minute < 1099) step(s);
    await page.setViewportSize({ width, height });
    await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.clock.install();
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 250);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
      game: s.version,
      plainNarration: true,
      seed: s.seed,
      inputs: s.inputs,
      minute: s.minute,
      pages: [],
    });
    await page.goto('/');
    await page.locator('#cont').click();
    const ticket = page.locator('.slip').filter({ hasText: '₺40 at risk' }).first();
    await expect(ticket).toBeInViewport({ ratio: 1 });
    await expect(ticket).toContainText('Waiting for the grill');
    await expect(page.locator('#service-account')).toContainText('0 left');
    // Continue the real renderer and clock with no service choices.
    await page.clock.runFor(100000);
    await expect(page.locator('#service-account')).toContainText('1 left');
    await expect(page.locator('#service-account')).toContainText('₺40');
    const boxes = await page.evaluate(() => ({
      scene: document.querySelector('#scene')?.getBoundingClientRect().bottom ?? -1,
      board: document.querySelector('.service-board')?.getBoundingClientRect().top ?? -1,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(boxes.board).toBeGreaterThanOrEqual(boxes.scene);
    expect(boxes.overflow).toBe(false);
  });
}

test('zero service input cannot serve every Monday table', async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  const s = newGame(42, 'pass@18');
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    plainNarration: true,
    seed: s.seed,
    inputs: s.inputs,
    minute: s.minute,
    pages: [],
  });
  await page.clock.install();
  await page.addInitScript(() => {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 250);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  await page.goto('/');
  await page.locator('#cont').click();
  await expect(page.locator('.early-booking')).toContainText('18:24');
  await page.locator('#open-service').click();
  for (let i = 0; i < 20 && (await page.locator('.service').count()); i++) await page.clock.runFor(60000);
  await expect(page.locator('.closing-choices')).toContainText('Tables: 14 of 15 ate');
  await expect(page.locator('.closing-choices')).toContainText('₺40');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? 'null'));
  expect(save.inputs.filter((i: { kind: string }) => !['board', 'open'].includes(i.kind))).toEqual([]);
});
