import { expect, test } from '@playwright/test';
import { partyOf } from '../../src/sim/campaign.ts';
import { beginAtWeekTwo, firstPartyBoard } from '../../src/sim/firstweek.ts';
import { boardDefaults, queueInput, step } from '../../src/sim/kitchen.ts';

for (const [width, height] of [
  [360, 690],
  [820, 1180],
  [1180, 820],
  [1280, 800],
] as const) {
  test(`people-run party keeps its promise visible without cooking controls at ${width}x${height}`, async ({
    page,
  }) => {
    const s = beginAtWeekTwo(42);
    for (const id of s.sunday?.parties ?? [])
      queueInput(s, { kind: 'choose', key: `promise:${id}`, value: 'promise' });
    const booking = firstPartyBoard(s);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    while (s.minute <= booking.at) step(s);
    const party = partyOf(booking.party);
    if (!party) throw new Error('Expected party');
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: new Date('2026-10-21T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-21T12:01:00Z'));
    await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
      game: s.version,
      seed: s.seed,
      inputs: s.inputs,
      minute: s.minute,
      pages: [],
    });
    await page.goto('/');
    await page.locator('#cont').click();
    const card = page.locator('.party-slip').filter({ hasText: party.host });
    await expect(card).toContainText('promised: first at the pass');
    await expect(card).toContainText('serve by');
    await expect(card).toContainText(`table ${s.tickets.find((t) => t.id === booking.ticket)?.table}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport({ ratio: 1 });
    await expect(
      page.locator('#chef-work, [data-cook-step], [data-cook-choice], [data-call-plate], [data-ticket]'),
    ).toHaveCount(0);
    await expect(page.locator('.crew button').first()).toBeVisible();
  });
}
