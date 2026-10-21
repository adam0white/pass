import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { partyOf } from '../../src/sim/campaign.ts';
import { beginAtWeekTwo, firstPartyBoard } from '../../src/sim/firstweek.ts';
import { advance } from '../../src/sim/host-policy.ts';
import { boardDefaults, queueInput } from '../../src/sim/kitchen.ts';

const shots = '/Users/abdul/code/.lab-scratch/pass-213/shots';

for (const [width, height] of [
  [360, 690],
  [412, 891],
] as const) {
  test(`active party context stays beside cooking controls at ${width}x${height}`, async ({ page }) => {
    const s = beginAtWeekTwo(42);
    for (const id of s.sunday?.parties ?? [])
      queueInput(s, { kind: 'choose', key: `promise:${id}`, value: 'promise' });
    const booking = firstPartyBoard(s);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    for (let turns = 0; turns < 1000; turns++) {
      if (s.help?.signature && s.help.ticket === booking.ticket) break;
      advance(s, 'flex-chef');
    }
    expect(s.help?.signature).toBe(true);
    const party = partyOf(booking.party);
    if (!party) throw new Error('Expected party');
    await page.setViewportSize({ width, height });
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
    await page.locator('#cont').click();
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/active-party-after-${width}x${height}.png` });
    const context = page.locator('.active-party');
    await expect(context).toContainText(party.host);
    await expect(context).toContainText(`Promised: ${party.signature.words}`);
    const clock = (m: number) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    await expect(context).toContainText(`out by ${clock(booking.servedBy)}`);
    await expect(context).toBeInViewport({ ratio: 1 });
    const controls = page.locator('[data-cook-step], [data-cook-choice], [data-finish-portion]');
    for (const control of await controls.all()) await expect(control).toBeInViewport({ ratio: 1 });
    const before = await controls.first().boundingBox();
    await page.evaluate(() => {
      const app = Reflect.get(window, '__pass');
      app.state.said.push({
        who: 'narrator',
        kind: 'journal',
        at: app.state.minute,
        text: 'Another table is waiting.',
      });
      // Other tickets and the rail can change while this dish stays in the chef's hands.
      const ordinary = app.state.tickets.find((t: { party?: string }) => !t.party);
      ordinary.status = ordinary.status === 'open' ? 'left' : 'open';
      app.draw();
      document.getElementById('rail')?.scrollTo({ left: 1000 });
    });
    await expect(context).toBeInViewport({ ratio: 1 });
    expect(await controls.first().boundingBox()).toEqual(before);
    await page.evaluate(() => {
      const app = Reflect.get(window, '__pass');
      const s = app.state;
      for (const t of s.tickets.filter((t: { id: number }) => t.id !== s.help.ticket).slice(0, 3))
        Object.assign(t, {
          status: 'open',
          doneGrill: t.grill,
          doneCold: t.cold,
          doneOven: t.oven,
          platedAt: s.minute,
        });
      app.draw();
    });
    await expect(page.locator('.crowded-pass')).toHaveCount(1);
    expect(await controls.first().boundingBox()).toEqual(before);
    await expect(context).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => {
      const app = Reflect.get(window, '__pass');
      app.state.help.act = 2;
      app.state.help.readyAt = app.state.minute;
      app.draw();
    });
    await expect(page.locator('[data-cook-choice="careful"]')).toContainText('Other tables wait.');
    await expect(context).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-cook-choice="careful"]')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${shots}/active-party-choice-after-${width}x${height}.png` });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
