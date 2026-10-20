import { expect, type Page, test } from '@playwright/test';

async function fresh(page: Page, minutes = 0) {
  const { newGame, step } = await import('../../src/sim/kitchen.ts');
  const s = newGame(42);
  for (let minute = 0; minute < minutes; minute++) step(s);
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    seed: s.seed,
    inputs: s.inputs,
    minute: s.minute,
    pages: [],
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: /Back to the kitchen/ }).click();
}

test('Round 4 keeps cook targets and selection through request and answer', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page);
  const cook = page.locator('[data-pick="dilek"]');
  const original = await cook.boundingBox();
  await cook.click();
  expect(await cook.boundingBox()).toEqual(original);
  await page.locator('[data-v="grill"]').click();
  await expect(cook).toHaveAttribute('aria-pressed', 'true');
  expect(await cook.boundingBox()).toEqual(original);
  await page.clock.runFor(5000);
  await expect(cook).toHaveAttribute('aria-pressed', 'true');
  expect(await cook.boundingBox()).toEqual(original);
  await page.locator('#close').click();
  expect(await cook.boundingBox()).toEqual(original);
});

test('Round 4 explains station duration without a conflicting generic willingness line', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page);
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('.station-duration')).toContainText(/20:30|until|minutes/);
  await expect(page.locator('.forecast')).toHaveCount(0);
});

test('Round 4 imports, resumes and exports pass@3 under its original edition', async ({ page }) => {
  const { exportRun, newGame, queueInput, step } = await import('../../src/sim/kitchen.ts');
  const s = newGame(42, 'pass@3');
  queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
  for (let k = 0; k < 8; k++) step(s);
  const ex = exportRun(s, '2.8.0');
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.goto('/');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#file').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(ex)),
  });
  await expect(page.locator('.service')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(saved.game).toBe('pass@3');
  expect(saved.minute).toBe(s.minute);
  await page.reload();
  await page.getByRole('button', { name: /Back to the kitchen/ }).click();
  const result = await page.evaluate(async () => {
    const appPath = '/src/ui/app.ts';
    const simPath = '/src/sim/kitchen.ts';
    const state = (await import(appPath))._debug.state;
    return { minute: state.minute, exported: (await import(simPath)).exportRun(state, '2.8.0') };
  });
  expect(result.minute).toBe(s.minute);
  expect(result.exported.game).toBe('pass@3');
  expect(result.exported.state).toEqual(ex.state);
});

test('Round 4 lets the chef prepare food with a visible duration and queued acknowledgement', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page, 7);
  const help = page.locator('[data-help]').first();
  await expect(help).toContainText(/5 min/);
  await help.click();
  await expect(page.locator('.food-work')).toContainText(/Starting|preparing/);
  await page.clock.runFor(10000);
  await expect(page.locator('#sheet')).toContainText(/preparing|finished|ingredients back/);
});

test('Round 4 preserves keyboard focus through clock ticks and Enter asks once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page);
  await page.locator('[data-pick="selim"]').click();
  const grill = page.locator('[data-v="grill"]');
  await grill.focus();
  await page.clock.runFor(1000);
  await expect(grill).toBeFocused();
  await grill.press('Enter');
  const inputCount = await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    return (await import(path))._debug.state.inputs.filter((i: { kind: string }) => i.kind === 'ask').length;
  });
  expect(inputCount).toBe(1);
});

test('Round 4 keeps expanded opening notes open across clock ticks', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page);
  await page.getByText('Opening notes', { exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator('.journal details')).toHaveAttribute('open', '');
});

test('Round 4 keeps a departing cook selected and explains why more jobs are unavailable', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await fresh(page);
  await page.locator('[data-pick="selim"]').click();
  const home = page.locator('[data-v="home"]');
  const box = await home.boundingBox();
  if (!box) throw new Error('Expected home control');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(500);
  await page.mouse.up();
  await page.clock.runFor(1500);
  await expect(page.locator('[data-pick="selim"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-pick="selim"]')).toContainText('gone');
  await expect(page.locator('.station-duration')).toContainText('next service');
  for (const button of await page.locator('.verbs button').all()) await expect(button).toBeDisabled();
});
