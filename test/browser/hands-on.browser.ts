import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput, step } from '../../src/sim/kitchen.ts';

async function start(page: import('@playwright/test').Page) {
  const s = newGame(42, 'pass@7');
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
}

test('portion acts are at a station, with one actual rate and a readable ready moment', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  await page.getByRole('button', { name: 'Work grill', exact: true }).tap();
  await page.clock.runFor(800);
  await expect(page.locator('[data-cook-step]')).toBeVisible();
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.step(3);
    app._debug.refresh();
  });
  await expect(page.locator('[data-cook-step]')).toContainText(/ready|at \d\d:/);
  await expect(page.locator('#clock-rate')).toHaveCount(1);
});

test('a thumb holds the same ticket node and position through departures', async ({ page }) => {
  await start(page);
  const target = page.locator('[data-ticket]').first();
  const box = await target.boundingBox();
  const id = await target.getAttribute('data-ticket');
  await target.dispatchEvent('pointerdown', { pointerId: 1 });
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.step(20);
    app._debug.draw();
  });
  await expect(page.locator(`[data-ticket="${id}"]`)).toBeVisible();
  expect(await target.boundingBox()).toEqual(box);
  await target.dispatchEvent('pointerup', { pointerId: 1 });
  await target.click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs.at(-1).kind).toBe('help');
});

async function fixture(page: import('@playwright/test').Page, kind: string) {
  await page.evaluate(async (kind) => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    s.passDecision = null;
    s.request = null;
    s.staffing = [];
    if (kind === 'plate') {
      const t = s.tickets.find((t: { status: string }) => t.status === 'open');
      t.doneGrill = t.grill;
      t.doneCold = t.cold;
      t.doneOven = t.oven;
      t.platedAt = s.minute;
    }
    if (kind === 'request') s.request = { kind: 'phone', who: 'dilek', state: 'asking', at: s.minute };
    if (kind === 'staffing')
      s.staffing = [
        {
          id: 1,
          who: 'selim',
          station: 'grill',
          until: s.minute + 20,
          reason: 'I need to eat before I can continue on the grill, Chef.',
          state: 'asking',
        },
      ];
    app._debug.draw();
  }, kind);
}

async function visibleTargets(page: import('@playwright/test').Page, selector: string) {
  const buttonBoxes: { x: number; y: number; width: number; height: number }[] = [];
  expect(await page.locator(selector).count()).toBeGreaterThan(0);
  for (const target of await page.locator(selector).all()) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    if (await target.evaluate((el) => el.tagName === 'BUTTON')) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      buttonBoxes.push(box);
    }
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(690);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(await target.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  for (let i = 0; i < buttonBoxes.length; i++)
    for (let j = i + 1; j < buttonBoxes.length; j++) {
      const a = buttonBoxes[i];
      const b = buttonBoxes[j];
      if (!a || !b) continue;
      const overlap =
        Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1 &&
        Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1;
      expect(overlap).toBe(false);
    }
}

test('a stale portion tap is answered immediately in words', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  const target = page.locator('[data-ticket]').first();
  const id = Number(await target.getAttribute('data-ticket'));
  await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const state = app._debug.state;
    state.said = Array.from({ length: 200 }, () => ({
      ...state.said.at(-1),
      text: 'An earlier service line.',
    }));
  });
  await target.dispatchEvent('pointerdown');
  await page.evaluate(async (id) => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.state.tickets.find((t: { id: number }) => t.id === id).status = 'served';
    app._debug.draw();
  }, id);
  await target.dispatchEvent('pointerup');
  await target.click();
  await expect(page.locator('#caption')).toContainText('already been served');
  await page.clock.runFor(800);
  await expect(page.locator('.journal')).toContainText('already been served');
});

test('a plate at the pass is called by touch', async ({ page }) => {
  await start(page);
  await fixture(page, 'plate');
  await visibleTargets(page, '[data-call-plate]');
  await page.locator('[data-call-plate]').first().tap();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs.at(-1).kind).toBe('call-plate');
  await expect(page.locator('#caption')).toContainText('Service, table');
  await page.clock.runFor(800);
  await expect(page.locator('.journal')).toContainText('Service, table');
});

test('phone service choices and Selim jobs remain within the screen', async ({ page }) => {
  await start(page);
  await visibleTargets(page, '.priority-options button');
  await fixture(page, 'normal');
  await page.locator('[data-pick="selim"]').tap();
  await visibleTargets(page, '.verbs button, .who, .station-duration');
  await page.locator('#close').tap();
  await fixture(page, 'request');
  await visibleTargets(page, '#yes, #no');
  await fixture(page, 'staffing');
  await visibleTargets(page, '.staffing-options button');
  await page.getByRole('button', { name: 'Game menu', exact: true }).tap();
  await visibleTargets(page, '.game-menu-dialog button');
});

test('new arrivals keep each existing ticket target in its place', async ({ page }) => {
  await start(page);
  const target = page.locator('[data-ticket]').first();
  const id = await target.getAttribute('data-ticket');
  const before = await target.boundingBox();
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    const t = s.tickets.find((t: { status: string }) => t.status === 'waiting');
    t.status = 'open';
    app._debug.draw();
  });
  expect(await page.locator(`[data-ticket="${id}"]`).boundingBox()).toEqual(before);
});

test('a plated ticket stays put when new food work expands station copy', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  const id = await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    s.night = 8;
    const first = s.tickets.find((t: { status: string }) => t.status === 'open');
    for (const t of s.tickets) if (t.status === 'open') t.status = 'served';
    first.status = 'open';
    first.doneGrill = first.grill;
    first.doneCold = first.cold;
    first.doneOven = first.oven;
    first.platedAt = s.minute;
    app._debug.draw();
    return first.id;
  });
  const target = page.locator(`[data-ticket="${id}"]`);
  const before = await target.boundingBox();
  await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    const next = s.tickets.find((t: { status: string }) => t.status === 'waiting');
    next.status = 'open';
    next.grill = 2;
    next.cold = 2;
    next.oven = 2;
    app._debug.draw();
  });
  expect(await target.boundingBox()).toEqual(before);
});

const shots = '/Users/abdul/code/.lab-scratch/patterns/pass-shots';
async function capture(page: import('@playwright/test').Page, name: string) {
  mkdirSync(shots, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${shots}/after-${name}.png` });
  const audit = await page.locator('button:visible').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        text: element.textContent,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        clippedX: element.scrollWidth > element.clientWidth + 1,
      };
    }),
  );
  writeFileSync(`${shots}/after-${name}-geometry.json`, JSON.stringify(audit, null, 2));
}

test('after renders cover service, chef portion, plates, requests, staffing, Selim, menu and board', async ({
  page,
}) => {
  await start(page);
  await capture(page, 'priority-phone');
  await fixture(page, 'normal');
  await capture(page, 'service-phone');
  await page.getByRole('button', { name: 'Work grill', exact: true }).tap();
  await page.clock.runFor(800);
  await capture(page, 'portion-phone');
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.step(3);
    app._debug.draw();
  });
  await capture(page, 'portion-ready-phone');
  await page.setViewportSize({ width: 1280, height: 800 });
  await capture(page, 'service-desktop');
  await page.setViewportSize({ width: 360, height: 690 });
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.state.help = null;
    app._debug.draw();
  });
  await fixture(page, 'plate');
  await capture(page, 'plates-phone');
  await page.locator('[data-pick="selim"]').tap();
  await capture(page, 'selim-phone');
  await page.locator('#close').tap();
  await fixture(page, 'request');
  await capture(page, 'request-phone');
  await fixture(page, 'staffing');
  await capture(page, 'staffing-phone');
  await page.getByRole('button', { name: 'Game menu', exact: true }).tap();
  await capture(page, 'menu-phone');
  await page.getByRole('button', { name: 'Resume', exact: true }).tap();
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.state.phase = 'board';
    app._debug.refresh();
  });
  await page.locator('[data-board-cook="selim"] .board-change').tap();
  await capture(page, 'board-selim-phone');
  await visibleTargets(page, '#open-service');
  await page.locator('[data-board-cook="selim"] [data-field="station"]').last().tap();
  await visibleTargets(page, '#ask-board');
  await capture(page, 'board-changed-phone');
});

test('six waiting plates have complete touch targets on the phone', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    for (const ticket of s.tickets.slice(0, 6)) {
      ticket.status = 'open';
      ticket.doneGrill = ticket.grill;
      ticket.doneCold = ticket.cold;
      ticket.doneOven = ticket.oven;
      ticket.platedAt = s.minute;
    }
    app._debug.draw();
  });
  await expect(page.locator('[data-call-plate]')).toHaveCount(6);
  await visibleTargets(page, '[data-call-plate]');
  await capture(page, 'six-plates-phone');
});

test('later service has oven, four crew, and readable wedding portions', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  await page.evaluate(async () => {
    const app = { _debug: Reflect.get(window, '__pass') };
    const s = app._debug.state;
    const cooksPath = '/src/sim/cooks.ts';
    const cooks = await import(cooksPath);
    s.night = 18;
    s.oven.heat = 100;
    s.cooks.find((c: { id: string }) => c.id === 'rafi').here = true;
    const z = cooks.hireTemplate('zeynep');
    s.people.push(cooks.makeHire(z, s.seed, s.minute));
    s.crew.push({ id: z.id, name: z.name, home: z.home, founder: false, since: 1, wage: z.wage });
    s.cooks.push({
      ...structuredClone(s.cooks[0]),
      id: z.id,
      here: true,
      gone: false,
      pending: null,
      deferred: null,
    });
    s.tickets[0] = {
      ...s.tickets[0],
      due: s.minute + 60,
      grill: 20,
      cold: 20,
      oven: 20,
      doneGrill: 1,
      doneCold: 0,
      doneOven: 0,
    };
    app._debug.draw();
  });
  await expect(page.locator('[data-chef-station="oven"]')).toBeVisible();
  await expect(page.locator('.crew button')).toHaveCount(4);
  await visibleTargets(page, '.crew button, [data-chef-station]');
  expect(await page.locator('.slip.wedding').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
    true,
  );
  await capture(page, 'oven-wedding-four-crew-phone');
  await page.locator('[data-pick="selim"]').tap();
  await visibleTargets(page, '.verbs button');
  await capture(page, 'oven-selim-four-crew-phone');
});

test('after close and final notebook render on the phone', async ({ page }) => {
  await start(page);
  await fixture(page, 'normal');
  await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.step(400);
    app._debug.refresh();
  });
  await capture(page, 'after-close-phone');
  await page.evaluate(() => {
    const app = { _debug: Reflect.get(window, '__pass') };
    app._debug.state.phase = 'end';
    app._debug.refresh();
  });
  await capture(page, 'ending-phone');
  await page.getByRole('button', { name: 'Game menu', exact: true }).tap();
  await visibleTargets(page, '.game-menu-dialog button');
});

test('a pointer released outside the rail and a window blur both recover rendering', async ({ page }) => {
  await start(page);
  const target = page.locator('[data-ticket]').first();
  await target.dispatchEvent('pointerdown');
  await page.locator('body').dispatchEvent('pointerup');
  await page.clock.runFor(800);
  await fixture(page, 'normal');
  await expect(page.locator('[data-chef-station="grill"]')).toBeVisible();
  await target.dispatchEvent('pointerdown');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(800);
  await fixture(page, 'request');
  await expect(page.locator('#yes')).toBeVisible();
});
