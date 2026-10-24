import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput, step } from '../../src/sim/kitchen.ts';

async function start(page: Page, minute = 1060) {
  const s = newGame(42, 'pass@6');
  if (s.phase === 'board') {
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
  }
  while (s.minute < minute && s.phase === 'service') step(s);
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    seed: s.seed,
    inputs: s.inputs,
    minute: s.minute,
    pages: [],
  });
  await page.goto('/?lab=1');
  await page.getByRole('button', { name: /Resume/ }).click();
}

async function onScreen(page: Page, selector: string) {
  for (const target of await page.locator(selector).all()) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('Missing target geometry');
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(690);
  }
}

test('Game menu autosaves and offers feedback with a downloadable copy', async ({ page }) => {
  await start(page);
  await onScreen(page, '#game-menu');
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Game menu', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Save this kitchen', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Download this run', exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Feedback', exact: true }).click();
  const feedback = page.getByRole('dialog', { name: 'Feedback', exact: true });
  await expect(feedback).toBeVisible();
  await expect(feedback.getByRole('button', { name: 'Keep a copy of this run', exact: true })).toBeVisible();
  await feedback.getByRole('button', { name: 'Back to the menu', exact: true }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#game-menu')).toBeFocused();
});

test('station control reserves a portion immediately and keeps its exact label', async ({ page }) => {
  await start(page, 1060);
  const grill = page.getByRole('button', { name: 'Work grill', exact: true });
  await expect(grill).toBeEnabled();
  const position = await grill.boundingBox();
  await grill.tap();
  await expect(page.locator('#chef-work')).toContainText(/Table 1:.*portion/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(saved.inputs.at(-1)).toMatchObject({ kind: 'help', station: 'grill' });
  await expect(grill).toBeVisible();
  await expect(grill).toBeDisabled();
  expect(await grill.boundingBox()).toEqual(position);
  await onScreen(page, '#game-menu, #chef-work, .crew button');
});

test('real touch and desktop renders show station work and the Game menu', async ({ page }) => {
  const shots = '/Users/abdul/code/.lab-scratch/patterns/pass-shots/legacy6';
  mkdirSync(shots, { recursive: true });
  await start(page, 1060);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${shots}/chef-phone-d.png` });
  await page.getByRole('button', { name: 'Work grill', exact: true }).tap();
  await page.screenshot({ path: `${shots}/chef-working-phone-d.png` });
  await page.getByRole('button', { name: 'Game menu', exact: true }).tap();
  await page.screenshot({ path: `${shots}/menu-phone-d.png` });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${shots}/chef-desktop-d.png` });
});

test('send cancellation returns to Game menu and keeps service time still', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Feedback', exact: true })).toBeVisible();
  const before = await page.locator('#clock').textContent();
  await page.clock.runFor(30000);
  expect(await page.locator('#clock').textContent()).toBe(before);
  await page.getByRole('button', { name: 'Back to the menu', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Game menu', exact: true })).toBeVisible();
  await expect(page.locator('#send-run')).toBeVisible();
});

test('a waiting ticket reserves its portion directly', async ({ page }) => {
  await start(page);
  await page.locator('button.slip:not([disabled])').first().tap();
  await expect(page.locator('#chef-work')).toContainText('portion');
  await expect(page.locator('.chef-stations button:enabled')).toHaveCount(0);
});

test('priority decision slows playback and marks the chosen table before restoring Fast', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'fast', exact: true }).click();
  await expect(page.locator('#clock-rate')).toContainText('Slow · 0.1 min/s');
  await onScreen(page, '.priority-card, .priority-options button');
  await page.locator('[data-priority]').first().tap();
  await expect(page.locator('#clock-rate')).toContainText('Fast · 3.5 min/s');
  await expect(page.locator('#rail')).toContainText('First on the pass');
  await expect(page.locator('.journal')).toContainText(/first/);
  await expect(page.getByRole('button', { name: 'fast', exact: true })).toHaveClass(/on/);
});

test('working a portion leaves a priority call waiting without slowing its completion', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'fast', exact: true }).click();
  await page.getByRole('button', { name: 'Work grill', exact: true }).tap();
  await expect(page.locator('.priority-options button')).toHaveCount(0);
  await expect(page.locator('.priority-card')).toContainText('Finish this portion');
  await expect(page.locator('#clock-rate')).toContainText('Fast · 3.5 min/s');
});

test('cook inspection keeps every job reachable on the phone after a priority call', async ({ page }) => {
  await start(page);
  await page.locator('[data-priority]').first().tap();
  await page.locator('[data-pick="selim"]').tap();
  await onScreen(page, '.who, .station-duration, .verbs button, #sheet .hint');
  await page.screenshot({
    path: '/Users/abdul/code/.lab-scratch/patterns/pass-shots/legacy6/cook-phone-d.png',
  });
});

test('station limits name warming and lost gas when portions are waiting', async ({ page }) => {
  await start(page);
  // Controlled browser fixture: exercise known blocking conditions without playing four weeks.
  await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const app = await import(appPath);
    const s = app._debug.state;
    s.night = 8;
    s.oven.heat = 0;
    s.passDecision = null;
    s.tickets = [{ ...s.tickets[0], status: 'open', oven: 1, doneOven: 0 }];
    app._debug.refresh();
  });
  await expect(page.getByRole('button', { name: 'Work oven', exact: true })).toContainText(
    'The oven is cold. No cook is warming it.',
  );
  await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const kitchenPath = '/src/sim/kitchen.ts';
    const app = await import(appPath);
    const kitchen = await import(kitchenPath);
    const s = app._debug.state;
    const id = kitchen.onShift(s)[0];
    kitchen.personOf(s, id).activity.affordanceId = 'oven';
    app._debug.refresh();
  });
  await expect(page.getByRole('button', { name: 'Work oven', exact: true })).toContainText(
    'The oven is warming.',
  );
  await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const campaignPath = '/src/sim/campaign.ts';
    const app = await import(appPath);
    const campaign = await import(campaignPath);
    const s = app._debug.state;
    const n = Array.from({ length: 24 }, (_, i) => i + 1).find((night) => campaign.planOf(night).gasOut);
    const plan = campaign.planOf(n);
    s.night = n;
    s.minute = campaign.nightStart(n) + plan.gasOut.from;
    app._debug.refresh();
  });
  await expect(page.getByRole('button', { name: 'Work grill', exact: true })).toContainText(
    'Waiting for gas',
  );
  await expect(page.getByRole('button', { name: 'Work oven', exact: true })).toContainText('Waiting for gas');
});

test('resuming from a scrolled title body keeps service and Game menu at the top', async ({ page }) => {
  await start(page);
  await page.reload();
  const resume = page.getByRole('button', { name: /Resume/ });
  await page.locator('.page-body').evaluate((body) => {
    body.scrollTop = body.scrollHeight;
  });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(resume).toBeInViewport({ ratio: 1 });
  await resume.tap();
  await expect(page.locator('.service')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await onScreen(page, '#game-menu, #clock');
});
