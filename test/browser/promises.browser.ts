import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

async function title(page: Page) {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}

async function targets(page: Page, selector: string, firstScreen = true) {
  for (const target of await page.locator(selector).all()) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    if (firstScreen) {
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
    }
  }
}

test('title pace is pressed visibly and recorded before the first board input', async ({ page }) => {
  await title(page);
  const pace = page.getByRole('button', { name: "Nevin's pace", exact: true });
  await expect(pace).toHaveAttribute('aria-pressed', 'false');
  await pace.tap();
  await expect(pace).toHaveAttribute('aria-pressed', 'true');
  await targets(page, '#pace, #new, #week-two');
  await page.locator('#new').tap();
  await page.locator('#open-service').tap();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs[0]).toMatchObject({ kind: 'pace', value: 'nevin' });
  expect(save.inputs[1].kind).toBe('board');
});

test('Begin at the second week opens two party choices and saves its Sunday', async ({ page }) => {
  await title(page);
  await page.getByRole('button', { name: 'Begin at the second week', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Sunday, week 1' })).toBeVisible();
  await expect(page.locator('.party-card')).toHaveCount(2);
  for (const card of await page.locator('.party-card').all()) {
    for (const name of ['Promise it', 'As it comes']) {
      const button = card.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    await targets(page, '.party-card button', false);
  }
  const promise = page.locator('.party-card [data-val="promise"]').first();
  const key = await promise.getAttribute('data-key');
  await promise.tap();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs.at(-1)).toMatchObject({ kind: 'choose', key, value: 'promise' });
  expect(save.pages).toEqual([{ week: 1, k: save.inputs.length - 1 }]);
  await expect(page.locator(`button[data-key="${key}"][data-val="promise"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const plain = page.locator('.party-card [data-val="plain"]:enabled').first();
  const plainKey = await plain.getAttribute('data-key');
  await plain.tap();
  const plainSave = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(plainSave.inputs.at(-1)).toMatchObject({ kind: 'choose', key: plainKey, value: 'plain' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Turn back to Sunday, week 1', exact: true })).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Turn back to Sunday, week 1', exact: true }).click();
  await expect(page.locator(`button[data-key="${key}"][data-val="promise"]`)).toBeEnabled();
});

async function savedParty(page: Page, phase: 'board' | 'service' | 'evening', promised = true) {
  const { beginAtWeekTwo } = await import('../../src/sim/firstweek.ts');
  const { boardDefaults, partiesTonight, queueInput, step } = await import('../../src/sim/kitchen.ts');
  const s = beginAtWeekTwo(42);
  expect(s.phase).toBe('sunday');
  for (const id of s.sunday?.parties ?? [])
    queueInput(s, { kind: 'choose', key: `promise:${id}`, value: promised ? 'promise' : 'plain' });
  const first = [...(s.bookings ?? [])].sort((a, b) => a.night - b.night)[0];
  if (!first) throw new Error('Expected a returning party');
  queueInput(s, { kind: 'open' });
  while (s.night < first.night && s.phase !== 'end') {
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    } else if (s.phase === 'evening') queueInput(s, { kind: 'open' });
    else step(s);
  }
  expect(s.night).toBe(first.night);
  const booking = partiesTonight(s).find((b) => b.party === first.party);
  if (!booking) throw new Error('Expected tonight’s booking');
  if (phase !== 'board') {
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    while (s.phase === 'service' && s.minute <= booking.at) step(s);
    if (s.request?.state === 'asking') {
      queueInput(s, { kind: 'answer', choice: 'yes' });
      step(s);
    }
    if (phase === 'evening') while (s.phase === 'service') step(s);
  }
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.addInitScript((save) => localStorage.setItem('pass-save-v3', JSON.stringify(save)), {
    game: s.version,
    seed: s.seed,
    inputs: s.inputs,
    minute: s.minute,
    pages: [{ week: 1, k: beginAtWeekTwo(42).inputs.length }],
  });
  await page.goto('/');
  await page.locator('#cont').click();
  return { s, booking };
}

test('a promised ticket names its host, chef signature and served-by time', async ({ page }) => {
  const { partyOf } = await import('../../src/sim/campaign.ts');
  const { booking } = await savedParty(page, 'service');
  const party = partyOf(booking.party);
  if (!party) throw new Error('Expected party words');
  const ticket = page.getByRole('button', { name: `Work ${party.host}`, exact: true });
  await expect(ticket).toContainText('promised:');
  await expect(ticket.locator('.chef-signature')).toContainText(`${party.signature.words} (Chef’s)`);
  await expect(ticket).toContainText('out by');
  await expect(ticket).toHaveAccessibleDescription(/promised:.*Chef’s.*out by/);
  await expect(page.locator('.service')).toHaveClass(/hands-on/);
  await targets(page, '[data-cook-step], [data-finish-portion], .crew button');
});

test('an unpromised ticket says as it comes', async ({ page }) => {
  const { partyOf } = await import('../../src/sim/campaign.ts');
  const { booking } = await savedParty(page, 'service', false);
  const ticket = page.getByRole('button', { name: `Work ${partyOf(booking.party)?.host}`, exact: true });
  await expect(ticket).toContainText('as it comes');
  await expect(ticket).not.toContainText('promised:');
});

test('an arriving party leaves the previous table target in place', async ({ page }) => {
  await savedParty(page, 'service');
  const id = await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    const s = app.state;
    const party = s.tickets.find((t: { party?: string }) => t.party);
    party.status = 'waiting';
    // Keep an ordinary table present while the party arrives.
    const ordinary = s.tickets.find((t: { party?: string }) => !t.party);
    ordinary.status = 'open';
    ordinary.grill = Math.max(1, ordinary.grill);
    ordinary.doneGrill = 0;
    // Hold the cooking panel constant while the party label enters the rail.
    s.help.ticket = ordinary.id;
    s.help.signature = false;
    app.draw();
    return ordinary.id;
  });
  const ticket = page.locator(`[data-ticket="${id}"]`);
  const before = await ticket.boundingBox();
  const workBefore = await page.locator('.chef-stations').boundingBox();
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.tickets.find((t: { party?: string }) => t.party).status = 'open';
    app.draw();
  });
  expect(await ticket.boundingBox()).toEqual(before);
  expect(await page.locator('.chef-stations').boundingBox()).toEqual(workBefore);
});

const shots = '/Users/abdul/code/.lab-scratch/pass-more/ui-shots';
for (const width of [360, 1280]) {
  test(`pass@9 title and Sunday renders at ${width}`, async ({ page }) => {
    mkdirSync(shots, { recursive: true });
    await page.setViewportSize({ width, height: width === 360 ? 690 : 800 });
    await title(page);
    await page.screenshot({ animations: 'disabled', path: `${shots}/title-${width}.png` });
    await page.locator('#week-two').tap();
    await expect(page.locator('.party-card')).toHaveCount(2);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ animations: 'disabled', path: `${shots}/sunday-${width}.png` });
    await page.screenshot({
      animations: 'disabled',
      path: `${shots}/sunday-full-${width}.png`,
      fullPage: true,
    });
    if (width === 360) await targets(page, '.party-card:first-of-type button');
  });
  for (const phase of ['board', 'service', 'evening'] as const) {
    test(`pass@9 party ${phase} renders at ${width}`, async ({ page }) => {
      mkdirSync(shots, { recursive: true });
      await page.setViewportSize({ width, height: width === 360 ? 690 : 800 });
      const { s, booking } = await savedParty(page, phase);
      await page.evaluate(() => document.fonts.ready);
      if (phase === 'service') await page.locator('.party-slip').scrollIntoViewIfNeeded();
      await page.screenshot({ animations: 'disabled', path: `${shots}/${phase}-${width}.png` });
      await page.screenshot({
        animations: 'disabled',
        path: `${shots}/${phase}-full-${width}.png`,
        fullPage: true,
      });
      if (phase === 'board') {
        await expect(page.locator('.board-parties')).toContainText(/No breaks overlap|break .* overlaps/);
        if (width === 360) await targets(page, '#open-service');
      }
      if (phase === 'evening') {
        const outcome = s.reports.at(-1)?.parties?.find((p) => p.party === booking.party);
        const { partyOf } = await import('../../src/sim/campaign.ts');
        if (!outcome?.outcome) throw new Error('Expected reported party outcome');
        await expect(page.locator('.party-outcome')).toContainText(
          partyOf(booking.party)?.[outcome.walked ? 'walked' : outcome.outcome] ?? '',
        );
      }
    });
  }
}

test('second-week start keeps Nevin’s pace as its first ordinary input', async ({ page }) => {
  await title(page);
  await page.locator('#pace').tap();
  await page.locator('#week-two').tap();
  await expect(page.getByRole('heading', { name: 'Sunday, week 1' })).toBeVisible();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(save.inputs[0]).toMatchObject({ kind: 'pace', value: 'nevin' });
});

test('evening and loss pages name a broken promise without claiming a short bill', async ({ page }) => {
  await savedParty(page, 'evening');
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    const s = app.state;
    const report = s.reports.at(-1);
    report.parties = [{ party: s.bookings[0].party, promised: true, outcome: 'broken', waited: 7 }];
    report.bill = {
      week: 2,
      owed: 'Ahmet the butcher',
      amount: 3000,
      paid: true,
      short: 0,
      promiseBroken: true,
    };
    app.refresh();
  });
  await expect(page.locator('.party-outcome')).toContainText(/Table 7 waited longest while I /);
  await expect(page.locator('.page')).toContainText('A promise broken this week: one strike.');
  await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    app.state.lost = true;
    app.state.phase = 'end';
    app.refresh();
  });
  await expect(page.locator('.page')).toContainText('A promise broken this week: one strike.');
  await expect(page.locator('.page')).not.toContainText('₺0 short');
});

test('party overlap lines follow proposed and agreed meal breaks by cook name', async ({ page }) => {
  await savedParty(page, 'board');
  await expect(page.locator('.board-parties')).toContainText('No breaks overlap.');
  const selim = page.locator('[data-board-cook="selim"]');
  await selim.getByRole('button', { name: 'Change', exact: true }).tap();
  await selim.getByRole('button', { name: '19:45 during the rush', exact: true }).tap();
  await expect(page.locator('.board-parties')).toContainText(
    'Proposed breaks: Selim’s break 19:45–20:05 overlaps.',
  );
  await page.locator('#ask-board').tap();
  await expect(selim.locator('.board-answer')).toContainText('Agreed.');
  await expect(page.locator('.board-parties')).toContainText('Selim’s break 19:45–20:05 overlaps.');
  await expect(page.locator('.board-parties')).not.toContainText('Proposed');
});

test('starting a signature keeps existing table targets at the same height', async ({ page }) => {
  await savedParty(page, 'service');
  const fixture = await page.evaluate(() => {
    const app = Reflect.get(window, '__pass');
    const s = app.state;
    const help = structuredClone(s.help);
    const party = s.tickets.find((t: { party?: string }) => t.party);
    party.status = 'waiting';
    s.help = null;
    s.passDecision = null;
    const ordinary = s.tickets.find((t: { party?: string }) => !t.party);
    ordinary.status = 'open';
    app.draw();
    return { help, id: ordinary.id };
  });
  const before = await page.locator(`[data-ticket="${fixture.id}"]`).boundingBox();
  await page.evaluate(({ help }) => {
    const app = Reflect.get(window, '__pass');
    app.state.tickets.find((t: { party?: string }) => t.party).status = 'open';
    app.state.help = help;
    app.draw();
  }, fixture);
  expect(await page.locator(`[data-ticket="${fixture.id}"]`).boundingBox()).toEqual(before);
});

test('every party signature fits the reserved rail space without moving cooking controls', async ({
  page,
}) => {
  await savedParty(page, 'service');
  const positions = await page.evaluate(async () => {
    const campaignPath = '/src/sim/campaign.ts';
    const { PARTIES } = await import(campaignPath);
    const app = Reflect.get(window, '__pass');
    const s = app.state;
    const ticket = s.tickets.find((t: { party?: string }) => t.party);
    const booking = s.bookings.find((b: { ticket?: number }) => b.ticket === ticket.id);
    // Render each label with the largest number of distinct dish rows.
    Object.assign(ticket, { grill: 1, cold: 1, oven: 1, doneGrill: 0, doneCold: 0, doneOven: 0 });
    return PARTIES.map((party: { id: string }) => {
      ticket.party = party.id;
      booking.party = party.id;
      app.draw();
      const rail = document.getElementById('rail');
      const slip = document.querySelector('.party-slip');
      const work = document.querySelector('.chef-stations');
      return {
        id: party.id,
        railHeight: rail?.getBoundingClientRect().height,
        slipHeight: slip?.getBoundingClientRect().height,
        workTop: work?.getBoundingClientRect().y,
      };
    });
  });
  for (const position of positions) {
    expect(position.railHeight, position.id).toBe(148);
    expect(position.slipHeight, position.id).toBeLessThanOrEqual(136);
    expect(position.workTop, position.id).toBe(positions[0]?.workTop);
  }
});

test('the second-week board says nobody is on the oven and goes when someone takes it', async ({ page }) => {
  await title(page);
  await page.getByRole('button', { name: 'Begin at the second week', exact: true }).tap();
  for (const button of await page.locator('.party-card [data-val="plain"]').all()) await button.tap();
  await page.getByRole('button', { name: 'Open on Wednesday', exact: true }).tap();
  const note = page.locator('.board-uncovered');
  await expect(note).toContainText('Nobody is on the oven tonight.');
  await expect(note).toContainText('only a cook standing at it keeps it hot');
  await page.screenshot({ path: '/Users/abdul/code/.lab-scratch/pass-more/ui-shots/board-oven-phone.png' });
  const rafi = page.locator('[data-board-cook="rafi"]');
  await rafi.getByRole('button', { name: 'Change', exact: true }).tap();
  await rafi
    .getByRole('group', { name: /Station/ })
    .getByRole('button', { name: /oven/i })
    .tap();
  await expect(page.locator('.board-uncovered')).toHaveCount(0);
});
