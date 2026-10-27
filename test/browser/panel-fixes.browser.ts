import { expect, test } from '@playwright/test';
import { advance } from '../../src/sim/host-policy.ts';
import { boardDefaults, newGame, queueInput, step } from '../../src/sim/kitchen.ts';

test('People offer displays its answer and explains its disabled state', async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.clock.install();
  await page.goto('/');
  await page.locator('#new').click();
  await page.locator('#people').click();
  const people = page.getByRole('dialog', { name: 'People', exact: true });
  const offer = people.getByRole('button', { name: /Selim offers to share/ });
  await offer.click();
  await expect(people.getByRole('status')).toContainText('Nobody’s initials');
  await expect(offer).toBeDisabled();
  await expect(people).toContainText('already heard');
  await people.locator('#people-close').click();
  await page.locator('#open-service').click();
  await expect(page.locator('.service')).toBeVisible();
});

test('break edit preserves explicit cover choices across cooks', async ({ page }) => {
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.clock.install();
  const state = newGame(42, 'pass@17');
  while (state.night < 2) advance(state, 'ask');
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: state.version,
    plainNarration: true,
    seed: state.seed,
    inputs: state.inputs,
    minute: state.minute,
    pages: [],
  });
  await page.goto('/');
  await page.locator('#cont').click();
  const rows = page.locator('.board-row');
  const otherBefore = await rows.nth(1).locator('.board-summary').textContent();
  await rows.first().locator('.board-change').click();
  await page.locator('[data-field="cover"][data-value="rafi"]').click();
  await page.locator('[data-field="break"][data-value="1260"]').click();
  await page.locator('#board-done').click();
  await expect(rows.first()).toContainText('21:00');
  await expect(rows.first()).toContainText('You will ask Rafi to take over');
  expect(await rows.nth(1).locator('.board-summary').textContent()).toBe(otherBefore);
});

test('earned order receipt stays visible while inspecting a cook', async ({ page }) => {
  const state = newGame(42, 'pass@17');
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  queueInput(state, { kind: 'open' });
  while (!state.tickets.some((ticket) => ticket.status === 'served')) step(state);
  const receipt = state.said.findLast((line) => line.text.endsWith('added to the till.'));
  if (!receipt) throw new Error('Expected a paid order');
  await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.clock.install();
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: state.version,
    plainNarration: true,
    seed: state.seed,
    inputs: state.inputs,
    minute: state.minute,
    pages: [],
  });
  await page.goto('/');
  await page.locator('#cont').click();
  await expect(page.locator('#caption')).toContainText(receipt.text);
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('#caption')).toContainText(receipt.text);
});
