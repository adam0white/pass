import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  cookOf,
  GAME_VERSION,
  type GameState,
  memberOf,
  newGame,
  onShift,
  queueInput,
  replay,
  stationOf,
  step,
} from '../../src/sim/kitchen.ts';

async function start(page: Page, state?: GameState) {
  const time = new Date('2026-10-20T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  if (state !== undefined) {
    await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
      game: GAME_VERSION,
      seed: 42,
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
  for (const element of await page.locator(selector).all()) {
    await expect(element).toBeVisible();
    const box = await element.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }
}

test('DL-5 shows what is waiting before and immediately after a job request', async ({ page }) => {
  await start(page);
  await expect(page.locator('#status')).toContainText('next ticket');
  await page.locator('[data-pick="selim"]').click();
  await page.locator('[data-v="grill"]').click();
  await expect(page.locator('#status')).toContainText('Selim');
  await expect(page.locator('#status')).toContainText('answer');
});

test('DL-3 marks an unanswered request while speed selection stays neutral', async ({ page }) => {
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
  const colors = await page.locator('.speed button.on').evaluate((b) => ({
    color: getComputedStyle(b).color,
    ink: getComputedStyle(document.body).color,
  }));
  expect(colors.color).toBe(colors.ink);
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
    await onScreen(page, '#status, .crew button, .who, .forecast, .verbs button, #sheet .hint');
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(690);
  }
  await page.addStyleTag({ content: ':root { --safe-t: 20px; --safe-b: 20px; }' });
  await onScreen(page, '#status, .crew button, .who, .forecast, .verbs button, #sheet .hint');
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
  await page.clock.runFor(5000);
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
  await onScreen(page, '#status, #rail, .who, .forecast, .verbs button, #sheet .hint');
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
  await onScreen(page, '#status, #caption, #caption button, .who, .forecast, .verbs button, #sheet .hint');
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

test('DL-6 counts journal and first job choice separately from optional opening notes', async ({ page }) => {
  const time = new Date('2026-10-20T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto('/');
  const words = (text: string) => (text.trim() ? text.trim().split(/\s+/u).length : 0);
  const opening = await page.locator('.page > h1, .page > p').allTextContents();
  const story = await page.locator('.page > p:not(.soft)').allTextContents();
  await page.getByText('More about the kitchen', { exact: true }).click();
  await expect(page.locator('details')).toContainText('Hold the job to insist.');
  await expect(page.locator('details')).toContainText('● is ready.');
  await page.getByText('More about the kitchen', { exact: true }).click();
  await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
  const journal = (await page.locator('.journal').innerText()).replace('Opening notes', '');
  const service = await page.locator('#status, #sheet > .hint').allTextContents();
  await page.getByText('Opening notes', { exact: true }).click();
  await expect(page.locator('.journal')).toContainText(story[0] ?? '');
  await page.getByText('Opening notes', { exact: true }).click();
  await page.locator('[data-pick="selim"]').click();
  const choice = await page.locator('#sheet > .hint').allTextContents();
  expect(words(story.join(' '))).toBe(23);
  expect(words([...opening, ...service, journal, ...choice].join(' '))).toBeLessThanOrEqual(50);
});
