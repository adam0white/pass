import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput, step } from '../../src/sim/kitchen.ts';

async function start(page: Page) {
  const s = newGame(42, 'pass@8');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.minute < 1060) step(s);
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
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    Object.assign(app.state, { passDecision: null, request: null, staffing: [] });
    app.draw();
  });
  await page.getByRole('button', { name: 'Work at the grill', exact: true }).tap();
}

test('a large food surface carries the act and updates immediately after a touch', async ({ page }) => {
  await start(page);
  const surface = page.locator('.food-surface');
  await expect(surface).toBeVisible();
  expect((await surface.boundingBox())?.height).toBeGreaterThanOrEqual(140);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.step(3);
    app.state.help.readyAt = app.state.minute;
    app.draw();
  });
  await page.clock.runFor(800);
  await expect(page.locator('[data-cook-step]')).toBeEnabled();
  const before = await page.locator('[data-cook-step]').textContent();
  await page.locator('[data-cook-step]').tap();
  expect(await page.locator('[data-cook-step]').textContent()).not.toBe(before);
});

test('active food remains reachable while inspecting Selim', async ({ page }) => {
  await start(page);
  await page.locator('[data-pick="selim"]').tap();
  await expect(page.locator('[data-cook-step]')).toBeVisible();
  const box = await page.locator('[data-cook-step]').boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  await expect(page.locator('.verbs button').first()).toBeVisible();
});

const shots = '/Users/abdul/code/.lab-scratch/patterns/pass-shots';
test('round two food surface renders at phone and desktop sizes', async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await start(page);
  await page.evaluate(() => document.fonts.ready);
  if (process.env.PASS_SCREENSHOTS === '1') await page.screenshot({ path: `${shots}/portion-phone-b.png` });
  await page.locator('[data-pick="selim"]').tap();
  if (process.env.PASS_SCREENSHOTS === '1')
    await page.screenshot({ path: `${shots}/portion-selim-phone-b.png` });
  await page.locator('#close').tap();
  await page.setViewportSize({ width: 1280, height: 800 });
  if (process.env.PASS_SCREENSHOTS === '1') await page.screenshot({ path: `${shots}/portion-desktop-b.png` });
});

async function readyChoice(page: Page) {
  await page.clock.runFor(800);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.help.act = 2;
    app.state.help.readyAt = app.state.minute;
    app.draw();
  });
}

test('food choice shows both time costs and remains usable while inspecting a cook', async ({ page }) => {
  await start(page);
  await readyChoice(page);
  await expect(page.locator('[data-cook-choice="now"]')).toContainText('Take it off now');
  await expect(page.locator('[data-cook-choice="careful"]')).toContainText('3 more kitchen minutes');
  await page.locator('[data-pick="selim"]').tap();
  for (const target of await page.locator('[data-cook-choice], [data-finish-portion]').all()) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }
  await page.locator('[data-cook-choice="careful"]').tap();
  await expect(page.locator('[data-cook-choice]')).toHaveCount(0);
  await expect(page.locator('[data-cook-step]')).toContainText('plate');
  await expect(page.locator('#caption')).toContainText('The food gets three more minutes');
});

test('a busy chef can reserve next and delegate the current portion without changing room speed', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Work at the cold side', exact: true }).tap();
  await expect(page.locator('.chef-next')).toContainText('Chef’s next');
  await page.locator('[data-pick="selim"]').tap();
  await page.locator('[data-finish-portion]').tap();
  await expect(page.locator('[data-cook-step], [data-cook-choice]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'steady', exact: true })).toHaveClass(/on/);
  await expect(page.locator('#clock-rate')).toContainText('Reading · 0.5 minutes per second');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs.at(-1).kind).toBe('finish-portion');
});

test('round two choice and inspection renders', async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await start(page);
  await readyChoice(page);
  await page.evaluate(() => document.fonts.ready);
  if (process.env.PASS_SCREENSHOTS === '1') await page.screenshot({ path: `${shots}/choice-phone-b.png` });
  const crew = await page.locator('.crew').boundingBox();
  expect((crew?.y ?? 0) + (crew?.height ?? 0)).toBeLessThanOrEqual(690);
  await page.locator('[data-pick="selim"]').tap();
  if (process.env.PASS_SCREENSHOTS === '1')
    await page.screenshot({ path: `${shots}/choice-selim-phone-b.png` });
  await page.locator('#close').tap();
  await page.setViewportSize({ width: 1280, height: 800 });
  if (process.env.PASS_SCREENSHOTS === '1') await page.screenshot({ path: `${shots}/choice-desktop-b.png` });
});

test('a final plate touch removes that portion control immediately', async ({ page }) => {
  await start(page);
  await page.clock.runFor(800);
  const ticket = await page.locator('[data-cook-step]').getAttribute('data-cook-step');
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.help.act = 3;
    app.state.help.readyAt = app.state.minute;
    app.draw();
  });
  await page.locator('[data-cook-step]').tap();
  await expect(page.locator(`[data-cook-step="${ticket}"]`)).toHaveCount(0);
  await expect(page.locator('#caption')).toContainText('finished');
});

test('long speech stays complete in the journal and never becomes an ellipsis in the scene', async ({
  page,
}) => {
  await start(page);
  await page.clock.runFor(800);
  const words = 'Table 9 first, Chef. The others will wait while I finish its food.';
  await page.evaluate((text) => {
    const app = Reflect.get(window, '__pass');
    app.state.help = null;
    app.state.said.push({ who: 'selim', at: app.state.minute, text, kind: 'answer' });
    app.draw();
  }, words);
  await expect(page.locator('.journal')).toContainText(words);
  await expect(page.locator('#bub')).not.toContainText('…');
});

test('plated rail tickets leave service to the visible plate controls', async ({ page }) => {
  await start(page);
  await page.clock.runFor(800);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.help = null;
    for (const ticket of app.state.tickets.slice(0, 6)) {
      Object.assign(ticket, {
        status: 'open',
        doneGrill: ticket.grill,
        doneCold: ticket.cold,
        doneOven: ticket.oven,
        platedAt: app.state.minute,
      });
    }
    app.draw();
  });
  await expect(page.locator('button.slip:enabled')).toHaveCount(0);
  await expect(page.locator('[data-call-plate]')).toHaveCount(6);
});

test('a food choice, six service calls and the crew fit together on the phone', async ({ page }) => {
  await start(page);
  await readyChoice(page);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    for (const ticket of app.state.tickets
      .filter((t: { id: number }) => t.id !== app.state.help.ticket)
      .slice(0, 6)) {
      Object.assign(ticket, {
        status: 'open',
        doneGrill: ticket.grill,
        doneCold: ticket.cold,
        doneOven: ticket.oven,
        platedAt: app.state.minute,
      });
    }
    app.draw();
  });
  for (const target of await page
    .locator('[data-cook-choice], [data-finish-portion], [data-call-plate], .crew button')
    .all()) {
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }
  if (process.env.PASS_SCREENSHOTS === '1')
    await page.screenshot({ path: `${shots}/combined-choice-plates-phone-b.png` });
});

test('a personal request stays reachable while a cooking choice waits', async ({ page }) => {
  await start(page);
  await readyChoice(page);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.request = { kind: 'mother', who: 'selim', state: 'asking', at: app.state.minute };
    app.draw();
  });
  for (const target of await page.locator('[data-cook-choice], [data-finish-portion], #yes, #no').all()) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }
  if (process.env.PASS_SCREENSHOTS === '1')
    await page.screenshot({ path: `${shots}/combined-choice-request-phone-b.png` });
});

for (const decision of ['request', 'staffing'] as const) {
  test(`an active ${decision} takes precedence over a waiting table priority during cooking`, async ({
    page,
  }) => {
    await start(page);
    await readyChoice(page);
    await page.evaluate((kind) => {
      const app = Reflect.get(window, '__pass');
      const s = app.state;
      s.passDecision = {
        state: 'asking',
        at: s.minute,
        tickets: s.tickets
          .filter((t: { status: string }) => t.status === 'open')
          .map((t: { id: number }) => t.id),
      };
      if (kind === 'request') s.request = { kind: 'mother', who: 'selim', state: 'asking', at: s.minute };
      else
        s.staffing = [
          {
            id: 1,
            who: 'selim',
            station: 'grill',
            until: s.minute + 20,
            reason: 'I need to eat before I continue, Chef.',
            state: 'asking',
          },
        ];
      app.draw();
    }, decision);
    const responses = decision === 'request' ? page.locator('#yes, #no') : page.locator('[data-cover]');
    expect(await responses.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.priority-card')).toHaveCount(0);
    await expect(page.locator('[data-cook-choice]')).toHaveCount(2);
    await expect(page.locator('[data-finish-portion]')).toBeVisible();
    for (const target of await responses.all()) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
    }
  });
}

test('a table priority waiting behind cooking leaves cook inspection available', async ({ page }) => {
  await start(page);
  await readyChoice(page);
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    const s = app.state;
    s.passDecision = {
      state: 'asking',
      at: s.minute,
      tickets: s.tickets
        .filter((t: { status: string }) => t.status === 'open')
        .map((t: { id: number }) => t.id),
    };
    app.draw();
  });
  await page.locator('[data-pick="selim"]').tap();
  await expect(page.locator('.verbs button').first()).toBeVisible();
  await expect(page.locator('[data-cook-choice]')).toHaveCount(2);
  await expect(page.locator('[data-finish-portion]')).toBeVisible();
  await expect(page.locator('.priority-card')).toHaveCount(0);
});
