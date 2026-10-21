import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  cookOf,
  type GameState,
  memberOf,
  newGame as newEditionGame,
  onShift,
  queueInput,
  replay as replayEdition,
  stationOf,
  step,
} from '../../src/sim/kitchen.ts';

const newGame = (seed: number) => newEditionGame(seed, 'pass@3');
const replay = (seed: number, inputs: Parameters<typeof replayEdition>[1], until?: number) =>
  replayEdition(seed, inputs, until, 'pass@3');

async function start(page: Page, state?: GameState) {
  const time = new Date('2026-10-20T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 60000));
  if (state !== undefined) {
    await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
      game: state.version,
      seed: state.seed,
      inputs: state.inputs,
      minute: state.minute,
      pages: [],
    });
  }
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole('button', { name: state === undefined ? 'Open the doors' : /Back to the kitchen/ })
    .click();
}

async function onScreen(page: Page, selector: string) {
  await page.evaluate(() => document.fonts.ready);
  for (const element of await page.locator(selector).all()) {
    await expect(element).toBeVisible();
    const box = await element.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }
}

test('DL-5 shows what is waiting before and immediately after a job request', async ({ page }) => {
  await start(page, newGame(42));
  await expect(page.locator('#status')).toContainText('next ticket');
  await page.locator('[data-pick="selim"]').click();
  await page.locator('[data-v="grill"]').click();
  await expect(page.locator('#status')).toContainText('Selim');
  await expect(page.locator('#status')).toContainText('answer');
});

test('DL-3 marks an unanswered request while pacing stays automatic', async ({ page }) => {
  const s = newGame(42);
  while (s.night < 5) {
    if (s.phase === 'evening') queueInput(s, { kind: 'open' });
    else step(s);
  }
  while (s.request?.state !== 'asking' && s.phase === 'service') step(s);
  expect(s.request?.state).toBe('asking');
  await start(page, s);
  await expect(page.locator('#status')).toHaveClass(/needs-response/);
  await expect(page.locator('#yes')).toHaveClass(/primary/);
  await expect(page.locator('#no')).toHaveClass(/primary/);
  await expect(page.locator('#speed')).toHaveCount(0);
  await onScreen(page, '#status, #yes, #no, #sheet .card');
});

test('DL-22 keeps every job, forecast and instruction on screen after choosing either cook', async ({
  page,
}) => {
  const s = newGame(42);
  for (let i = 0; i < 50; i++) step(s);
  await start(page, s);
  for (const id of ['selim', 'dilek']) {
    await page.locator(`[data-pick="${id}"]`).click();
    await onScreen(page, '#status, .crew button, .who, .station-duration, .verbs button, #sheet .hint');
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(690);
  }
  await page.addStyleTag({ content: ':root { --safe-t: 20px; --safe-b: 20px; }' });
  await onScreen(page, '#status, .crew button, .who, .station-duration, .verbs button, #sheet .hint');
});

test('DL-22 gives a new request priority over an open cook sheet', async ({ page }) => {
  const s = newGame(42);
  while (s.night < 5) {
    if (s.phase === 'evening') queueInput(s, { kind: 'open' });
    else step(s);
  }
  while (s.request?.state !== 'asking' && s.phase === 'service') step(s);
  await start(page, replay(s.seed, s.inputs, s.minute - 2));
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('.verbs button')).not.toHaveCount(0);
  await page.clock.runFor(25000);
  await expect(page.locator('#status')).toContainText('Dilek');
  await expect(page.locator('.verbs button')).toHaveCount(0);
  await onScreen(page, '#status, #yes, #no, #sheet .card');
  await page.locator('#yes').click();
  await expect(page.locator('#status')).toContainText('respond');
  await expect(page.locator('#status')).not.toHaveClass(/needs-response/);
});

test('DL-22 fits seven jobs and long ticket labels with three cooks', async ({ page }) => {
  const s = newGame(42);
  while (s.night < 8 && s.phase !== 'end') {
    if (s.phase === 'evening' || s.phase === 'sunday') {
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
    if (s.minute % 6 === 0) {
      for (const id of onShift(s)) {
        if (!cookOf(s, id).pending && !stationOf(s, id))
          queueInput(s, { kind: 'ask', cook: id, verb: memberOf(s, id).home });
      }
    }
    step(s);
  }
  expect(s.night).toBe(8);
  for (let i = 0; i < 100; i++) step(s);
  await start(page, s);
  await expect(page.locator('.crew button')).toHaveCount(3);
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('.verbs button')).toHaveCount(7);
  // Stress the real ticket DOM with a long campaign label and all three portion rows.
  await page
    .locator('.slip')
    .first()
    .evaluate((slip) => {
      const title = slip.querySelector('.t');
      if (title) title.textContent = 'Mrs Arslan’s friend';
      if (slip.querySelectorAll('.d').length < 3)
        slip.insertAdjacentHTML('beforeend', '<div class="d">pide ○○</div>');
    });
  await onScreen(page, '#status, #rail, .who, .station-duration, .verbs button, #sheet .hint');
  const rail = await page.locator('#rail').boundingBox();
  for (const part of await page.locator('.slip .t, .slip .d, .slip .st').all()) {
    const box = await part.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((rail?.y ?? 0) + (rail?.height ?? 0));
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(690);
});

const counterSave = JSON.parse(
  readFileSync(new URL('../fixtures/clarity-counter-save.json', import.meta.url), 'utf8'),
);

test('DL-22 keeps a fresh counteroffer clickable above seven jobs with safe areas', async ({ page }) => {
  await start(page, replay(counterSave.seed, counterSave.inputs, counterSave.minute));
  await page.addStyleTag({ content: ':root { --safe-t: 20px; --safe-b: 20px; }' });
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('.verbs button')).toHaveCount(7);
  await expect(page.locator('#caption')).toContainText("I'll work the grill instead.");
  await onScreen(
    page,
    '#status, #caption, #caption button, .who, .station-duration, .verbs button, #sheet .hint',
  );
  const caption = await page.locator('#caption').boundingBox();
  const sheet = await page.locator('#sheet').boundingBox();
  expect((caption?.y ?? 0) + (caption?.height ?? 0)).toBeLessThanOrEqual(sheet?.y ?? 0);
  const counter = page.locator('[data-counter="grill"]');
  expect(
    await counter.evaluate((b) => {
      const r = b.getBoundingClientRect();
      return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
  await counter.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(saved.inputs.at(-1)).toMatchObject({ kind: 'ask', cook: 'selim', verb: 'grill', counter: true });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(690);
});

async function targets(page: Page, selector: string) {
  for (const element of await page.locator(selector).all()) {
    const box = await element.boundingBox();
    expect(box?.height, (await element.textContent()) ?? selector).toBeGreaterThanOrEqual(44);
    expect(box?.width, (await element.textContent()) ?? selector).toBeGreaterThanOrEqual(44);
  }
}

test('DL-23 gives disclosures, links, speed and counteroffers 44px targets', async ({ page }) => {
  await page.goto('/');
  await targets(page, 'summary, a, button');
  await start(page, replay(counterSave.seed, counterSave.inputs, counterSave.minute));
  await page.addStyleTag({ content: ':root { --safe-t: 20px; --safe-b: 20px; }' });
  await page.locator('[data-pick="selim"]').click();
  await targets(page, '.speed button, a, #caption button, #sheet button');
});

test('DL-6 offers a default board and the first currency gloss before service', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.page')).toContainText('₺5,200 (Turkish lira)');
  await page.getByText('More about the kitchen', { exact: true }).click();
  await expect(page.locator('details')).toContainText('Turkish lira');
  await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
  await expect(page.locator('.board-row')).toHaveCount(2);
  await expect(page.locator('.board-answer')).toHaveCount(2);
  await expect(page.locator('#ask-board')).toHaveCount(0);
  await expect(page.locator('#open-service')).toHaveText('Open the doors');
  await expect(page.locator('#open-service')).toBeEnabled();
  await expect(page.locator('.service')).toHaveCount(0);
});

test('DL-15 shows actual rates and inspection alone does not slow the clock', async ({ page }) => {
  await start(page, newGame(42));
  await expect(page.locator('#clock-rate')).toContainText('Steady · 1.5 min/s');
  await page.getByRole('button', { name: 'fast', exact: true }).click();
  await expect(page.locator('#clock-rate')).toContainText('Fast · 3.5 min/s');
  const rateBox = await page.locator('#clock-rate').boundingBox();
  const speedBox = await page.locator('#speed').boundingBox();
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('#clock-rate')).toContainText('Fast · 3.5 min/s');
  await page.clock.runFor(40000);
  await expect(page.locator('#clock-rate')).toContainText('Slow · 0.1 min/s');
  await expect(page.locator('#clock-rate')).toContainText('A station needs a cook.');
  expect(await page.locator('#clock-rate').boundingBox()).toEqual(rateBox);
  expect(await page.locator('#speed').boundingBox()).toEqual(speedBox);
  await page.locator('[data-v="grill"]').click();
  await expect(page.locator('#clock-rate')).toContainText('Fast · 3.5 min/s');
  await expect(page.getByRole('button', { name: 'fast', exact: true })).toHaveClass(/on/);
});

test('DL-20 quietly glosses maghrib in the journal without changing the saved simulation', async ({
  page,
}) => {
  const s = newGame(5151);
  while (!s.said.some((x) => x.text.includes('maghrib')) && s.phase === 'service') step(s);
  // start() restores the same seed as the supplied state.
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    seed: s.seed,
    inputs: s.inputs,
    minute: s.minute,
    pages: [],
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Back to the kitchen/ }).click();
  await expect(page.locator('.journal')).toContainText('maghrib (sunset prayer)');
});

test('DL-15 leaves a fast-speed request open during five real seconds of reading', async ({ page }) => {
  test.setTimeout(45000);
  const s = newGame(42);
  while (s.night < 5) {
    if (s.phase === 'evening') queueInput(s, { kind: 'open' });
    else step(s);
  }
  while (s.request?.state !== 'asking' && s.phase === 'service') step(s);
  const beforeRequest = replay(s.seed, s.inputs, s.minute - 2);
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    seed: s.seed,
    inputs: beforeRequest.inputs,
    minute: beforeRequest.minute,
    pages: [],
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Back to the kitchen/ }).click();
  await page.getByRole('button', { name: 'fast', exact: true }).click();
  await expect(page.locator('#yes')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#clock-rate')).toContainText('Slow · 0.1 min/s');
  const minute = () =>
    page.evaluate(async () => {
      const path = '/src/ui/app.ts';
      return (await import(path))._debug.state.minute as number;
    });
  const before = await minute();
  const realStart = Date.now();
  await page.waitForTimeout(5000);
  expect(Date.now() - realStart).toBeGreaterThanOrEqual(5000);
  expect((await minute()) - before).toBeLessThanOrEqual(1);
  await expect(page.locator('#yes')).toBeEnabled();
  await page.locator('#yes').click();
  await expect(page.locator('#status')).toContainText('respond');
  await expect(page.locator('#yes')).toHaveCount(0, { timeout: 12000 });
  await expect(page.locator('#clock-rate')).not.toContainText('Dilek needs an answer.');
  await expect(page.getByRole('button', { name: 'fast', exact: true })).toHaveClass(/on/);
});
