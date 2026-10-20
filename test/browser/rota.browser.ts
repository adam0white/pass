import { expect, type Page, test } from '@playwright/test';
import { newGame } from '../../src/sim/kitchen.ts';

async function start(page: Page) {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  const initial = newGame(42);
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem('pass-save-v3')) localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    { game: initial.version, seed: initial.seed, inputs: initial.inputs, minute: initial.minute, pages: [] },
  );
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#cont').click();
}

async function open(page: Page) {
  await start(page);
  await page.getByRole('button', { name: 'Ask the crew about this board', exact: true }).click();
  await page.locator('#open-service').click();
}

test('board edits receive cook answers and opening needs a current agreement', async ({ page }) => {
  await start(page);
  await expect(page.locator('.board-row')).toHaveCount(2);
  const actionBox = await page.locator('#board-form > .actions').boundingBox();
  expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(690);
  await page.getByLabel('Selim break time').fill('19:30');
  await page.getByRole('button', { name: 'Ask the crew about this board', exact: true }).click();
  await expect(page.locator('.board-answer')).toHaveCount(2);
  expect(await page.locator('#board-form > .actions').boundingBox()).toEqual(actionBox);
  await expect(page.locator('#open-service')).toBeEnabled();
  await page.getByLabel('Selim break time').fill('19:40');
  await expect(page.locator('#open-service')).toBeDisabled();
  await page.getByRole('button', { name: 'Ask about the revised board', exact: true }).click();
  await page.locator('#open-service').click();
  await expect(page.locator('.service')).toBeVisible();
  const state = await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    return (await import(path))._debug.state;
  });
  expect(state.version).toBe('pass@5');
  expect(state.board.rows.find((row: { cook: string }) => row.cook === 'selim').breakAt).toBe(1180);
  expect(state.inputs.filter((input: { kind: string }) => input.kind === 'ask')).toHaveLength(0);
});

test('a staffing break is one card with cover and leave choices and a slow clock', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const ui = await import(path);
    const simPath = '/src/sim/kitchen.ts';
    const sim = await import(simPath);
    const state = ui._debug.state;
    while (state.phase === 'service') sim.step(state);
    sim.queueInput(state, { kind: 'open' });
    sim.queueInput(state, { kind: 'board', rows: sim.boardDefaults(state) });
    sim.queueInput(state, { kind: 'open' });
    while (state.minute < 2610 && state.phase === 'service') sim.step(state);
    sim.personOf(state, 'dilek').body.satiety = 0.01;
    sim.step(state);
    ui._debug.refresh();
  });
  await expect(page.locator('.staffing-card')).toContainText('Dilek');
  await expect(page.locator('.staffing-card')).toContainText('Cold side uncovered for about 19 min');
  await expect(page.locator('#clock-rate')).toContainText('Slow · 0.1 min/s');
  await expect(page.getByRole('button', { name: 'Leave it uncovered', exact: true })).toBeVisible();
  await expect(page.locator('.verbs')).toHaveCount(0);
  for (const control of await page.locator('.staffing-card, [data-cover]').all()) {
    const box = await control.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }

  const leave = page.locator('[data-cover=""]');
  await leave.focus();
  await page.clock.runFor(10000);
  await expect(leave).toBeFocused();
  await expect(leave).toHaveText('Leave it uncovered');
  await page.addStyleTag({ content: ':root { --safe-t:20px; --safe-b:20px; }' });
  for (const control of await page.locator('.staffing-card, [data-cover]').all()) {
    const box = await control.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(670);
  }
  await page.getByRole('button', { name: 'Leave it uncovered', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Waiting for the cover answer');
  await page.clock.runFor(12000);
  await expect(page.locator('.staffing-card')).toHaveCount(0);
  await expect(page.locator('#clock-rate')).not.toContainText('needs a cover decision');
});

test('current service journal excludes a previous night departure', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const simPath = '/src/sim/kitchen.ts';
    const ui = await import(path);
    const sim = await import(simPath);
    const state = ui._debug.state;
    state.said.push({
      at: sim.openAt(state.night) - 10,
      who: 'narrator',
      text: 'Yesterday Selim left the kitchen.',
      kind: 'journal',
    });
    ui._debug.refresh();
  });
  await expect(page.locator('.journal')).not.toContainText('Yesterday Selim');
});

test('same as last night asks the carried board in one tap', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const simPath = '/src/sim/kitchen.ts';
    const ui = await import(path);
    const state = ui._debug.state;
    state.previousBoard = (await import(simPath)).boardDefaults(state);
    ui._debug.refresh();
  });
  await page.locator('#same-board').click();
  await expect(page.locator('.board-answer')).toHaveCount(2);
  await expect(page.locator('#open-service')).toBeEnabled();
});

test('the job dot matches the current station rather than the cook’s preference', async ({ page }) => {
  await open(page);
  for (const id of ['selim', 'dilek']) {
    await page.locator(`[data-pick="${id}"]`).click();
    const station = await page.evaluate(async (cook) => {
      const path = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      return (await import(simPath)).stationOf((await import(path))._debug.state, cook);
    }, id);
    const buttons = page.locator('.verbs button');
    for (const button of await buttons.all()) {
      const marked = (await button.innerText()).includes(' ·');
      expect(marked).toBe((await button.getAttribute('data-v')) === station);
    }
    await page.locator('#close').click();
  }
});

test('the saved title counts opening the board separately from starting a new night', async ({ page }) => {
  await open(page);
  await page.reload();
  await expect(page.locator('#cont')).toContainText('Monday, week 1');
});
