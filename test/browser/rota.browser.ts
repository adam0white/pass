import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { newGame } from '../../src/sim/kitchen.ts';

async function start(page: Page) {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  const initial = newGame(42, 'pass@5');
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem('pass-save-v3')) localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    { game: initial.version, seed: initial.seed, inputs: initial.inputs, minute: initial.minute, pages: [] },
  );
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#cont').click();
  await page.evaluate(() => document.fonts.ready);
}

async function open(page: Page) {
  await start(page);
  await page.locator('#open-service').click();
}

test('reading or resuming an unanswered baseline board leaves its notebook unchanged', async ({ page }) => {
  await start(page);
  const before = newGame(42, 'pass@5');
  const read = () =>
    page.evaluate(async () => {
      const path = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      return (await import(simPath)).cloneState((await import(path))._debug.state);
    });
  const { cloneState } = await import('../../src/sim/kitchen.ts');
  expect(await read()).toEqual(cloneState(before));
  await page.reload();
  await page.locator('#cont').click();
  expect(await read()).toEqual(cloneState(before));
  await page.locator('#open-service').click();
  const after = await read();
  expect(after.inputs.map((input: { kind: string }) => input.kind)).toEqual(['board', 'open']);
});

test('board chips use 24-hour slots and answers precede the actions', async ({ page }) => {
  await start(page);
  await expect(page.locator('.board-row')).toHaveCount(2);
  await expect(page.locator('.board-answer')).toHaveCount(2);
  await expect(page.locator('#board-form input, #board-form select')).toHaveCount(0);
  await expect(page.locator('#open-service')).toHaveText('Open the doors');
  await expect(page.locator('#ask-board')).toHaveCount(0);
  await expect(page.locator('[data-board-cook="selim"] .board-gap')).toHaveText(
    'You have not chosen anyone to take over. Nobody will work at the grill while Selim eats. Dilek could take over, but then nobody would work at the cold side.',
  );
  const dilek = page.locator('[data-board-cook="dilek"]');
  await dilek.getByRole('button', { name: 'Change', exact: true }).click();
  await dilek.getByRole('button', { name: '21:00 after the rush', exact: true }).click();
  await dilek.getByRole('button', { name: '18:35 during the rush', exact: true }).click();
  await expect(page.locator('#ask-board')).toHaveCount(0);
  const selim = page.locator('[data-board-cook="selim"]');
  await selim.getByRole('button', { name: 'Change', exact: true }).click();
  await selim.getByRole('button', { name: '19:45 during the rush', exact: true }).click();
  await expect(selim.getByRole('button', { name: '19:45 during the rush', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#open-service')).toBeDisabled();
  await expect(page.locator('#ask-board')).toHaveText('Ask them about the changes');
  await expect(selim.locator('.board-answer')).toContainText('Waiting for a new answer');
  await selim.getByRole('button', { name: '18:10 before the rush', exact: true }).click();
  await expect(page.locator('#open-service')).toBeEnabled();
  await expect(page.locator('#ask-board')).toHaveCount(0);
  await selim.getByRole('button', { name: '21:00 after the rush', exact: true }).click();
  await page.locator('#ask-board').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#open-service')).toBeFocused();
  await expect(page.locator('#ask-board')).toHaveCount(0);
  await expect(page.locator('#open-service')).toBeEnabled();
  expect(
    await page.locator('#board-form').evaluate((form) => {
      const cards = form.querySelector('.board-rows');
      const actions = form.querySelector('.actions');
      return (
        !!cards && !!actions && !!(cards.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);
  await page.locator('#open-service').click();
  await expect(page.locator('.service')).toBeVisible();
  const state = await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    return (await import(path))._debug.state;
  });
  expect(state.version).toBe('pass@5');
  expect(state.board.rows.find((row: { cook: string }) => row.cook === 'selim').breakAt).toBe(1260);
  expect(state.inputs.filter((input: { kind: string }) => input.kind === 'ask')).toHaveLength(0);
});

test('station chips ask for a fresh answer and retain a refusal before opening', async ({ page }) => {
  await start(page);
  const selim = page.locator('[data-board-cook="selim"]');
  await selim.getByRole('button', { name: 'Change', exact: true }).click();
  await selim.getByRole('button', { name: 'Cold side', exact: true }).click();
  await expect(page.locator('#open-service')).toBeDisabled();
  await expect(page.locator('#board-form > .actions .primary')).toHaveCount(2);
  await page.locator('#ask-board').click();
  await expect(selim.locator('.board-answer')).toContainText('Refused or asked for a change');
  await expect(selim.locator('.board-answer')).toContainText('not agreed');
  await expect(page.locator('#open-service')).toBeEnabled();
});

for (const width of [360, 1280]) {
  test(`board renders at ${width} with 44px chips, no overlap and named Tuesday relief`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 360 ? 690 : 800 });
    await start(page);
    const shots = process.env.PASS_SHOTS ?? testInfo.outputPath('renders');
    await mkdir(shots, { recursive: true });
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-agreements-${width}-c.png`, fullPage: true });
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-board-viewport-${width}-c.png` });
    if (width === 360) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(page.locator('.board-row').last()).toBeInViewport({ ratio: 1 });
    }
    const defaultActions = await page.locator('#board-form > .actions').boundingBox();
    const defaultCards = await page.locator('.board-rows').boundingBox();
    if (width === 360) {
      expect((defaultCards?.y ?? 0) + (defaultCards?.height ?? 0)).toBeLessThanOrEqual(
        defaultActions?.y ?? 0,
      );
      await expect(page.locator('#open-service')).toBeInViewport({ ratio: 1 });
    }
    if (width === 360) await page.locator('[data-board-cook="selim"] .board-change').click();
    await page.evaluate(() => document.fonts.ready);
    const boxes = await page.locator('.board-chips button:visible').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { label: button.textContent, x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    await writeFile(testInfo.outputPath('chip-geometry.json'), JSON.stringify({ width, boxes }, null, 2));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.height, box.label ?? '').toBeGreaterThanOrEqual(44);
      expect(box.width, box.label ?? '').toBeGreaterThanOrEqual(44);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        expect(
          a &&
            b &&
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height,
          JSON.stringify({ a, b }),
        ).toBe(false);
      }
    }
    const card = await page.locator('.board-row').last().boundingBox();
    const actions = await page.locator('#board-form > .actions').boundingBox();
    if (width === 1280) expect(actions?.y).toBeGreaterThanOrEqual((card?.y ?? 0) + (card?.height ?? 0));
    else expect((actions?.y ?? 0) + (actions?.height ?? 0)).toBeLessThanOrEqual(690);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await writeFile(
      `${shots}/final-metrics-${width}-c.json`,
      JSON.stringify(
        { width, height: width === 360 ? 690 : 800, defaultActions, defaultCards, boxes, actions, card },
        null,
        2,
      ),
    );
    await page.locator('#open-service').scrollIntoViewIfNeeded();
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-actions-${width}-c.png` });
    await page.locator('#open-service').click();
    await page.evaluate(async () => {
      const path = '/src/ui/app.ts';
      const simPath = '/src/sim/kitchen.ts';
      const ui = await import(path);
      const sim = await import(simPath);
      while (ui._debug.state.phase === 'service') sim.step(ui._debug.state);
      sim.queueInput(ui._debug.state, { kind: 'open' });
      ui._debug.refresh();
    });
    const selim = page.locator('[data-board-cook="selim"]');
    if (width === 360) await selim.getByRole('button', { name: 'Change', exact: true }).click();
    await expect(selim.getByRole('button', { name: /Rafi/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(selim.locator('.board-answer')).toContainText('Rafi:');
    await expect(selim.locator('.board-gap')).toContainText('Rafi has not agreed to take over');
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-tuesday-board-${width}-c.png`, fullPage: true });
    const board = await page.locator('.board-page').boundingBox();
    const notice = await page.locator('#recording-footer').boundingBox();
    expect(notice?.y).toBeGreaterThanOrEqual((board?.y ?? 0) + (board?.height ?? 0));
    const nobody = selim.getByRole('button', { name: 'Nobody', exact: true });
    await nobody.scrollIntoViewIfNeeded();
    expect(
      await nobody.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    await nobody.click();
    await expect(selim.getByRole('button', { name: 'Nobody', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#ask-board')).toBeVisible();
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-changes-${width}-c.png`, fullPage: true });
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: `${shots}/final-changes-viewport-${width}-c.png` });
    if (width === 360) {
      await page.evaluate(() => document.documentElement.style.setProperty('--safe-b', '20px'));
      await expect(page.locator('#same-board')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#ask-board')).toBeInViewport({ ratio: 1 });
      if (process.env.PASS_SCREENSHOTS === '1')
        await page.screenshot({ path: `${shots}/final-safe-actions-${width}-c.png` });
      await page.setViewportSize({ width: 320, height: 690 });
      await page.addStyleTag({ content: 'html, body { font-size: 34px; }' });
      await expect(page.locator('#same-board')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#ask-board')).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    }
  });
}

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
  await expect(page.locator('.staffing-card')).toContainText(
    'Nobody will work at the cold side for about 19 minutes',
  );
  await expect(page.locator('#clock-rate')).toContainText('Slow · 0.1 minutes per second');
  await expect(page.getByRole('button', { name: 'Leave the station empty', exact: true })).toBeVisible();
  await expect(page.locator('.verbs')).toHaveCount(0);
  for (const control of await page.locator('.staffing-card, [data-cover]').all()) {
    const box = await control.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
  }

  const leave = page.locator('[data-cover=""]');
  await leave.focus();
  await page.clock.runFor(10000);
  await expect(leave).toBeFocused();
  await expect(leave).toHaveText('Leave the station empty');
  await page.addStyleTag({ content: ':root { --safe-t:20px; --safe-b:20px; }' });
  for (const control of await page.locator('.staffing-card, [data-cover]').all()) {
    const box = await control.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(670);
  }
  await page.getByRole('button', { name: 'Leave the station empty', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Waiting for your choice of who takes over');
  await page.clock.runFor(12000);
  await expect(page.locator('.staffing-card')).toHaveCount(0);
  await expect(page.locator('#clock-rate')).not.toContainText('needs someone to take over');
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
  const carried = await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const state = (await import(path))._debug.state;
    return state.board.rows.map((row: { cover: string | null }) => row.cover);
  });
  expect(carried).toEqual([null, null]);
});

test('the “(now)” job marker matches the current station rather than the cook’s preference', async ({
  page,
}) => {
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
      const marked = (await button.textContent())?.includes(' (now)') ?? false;
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

test('phone board keeps default and edited actions reachable without covering the last answer', async ({
  page,
}) => {
  await start(page);
  await expect(page.locator('.board-fields:visible')).toHaveCount(0);
  await expect(page.locator('[data-board-cook="selim"] .board-summary')).toHaveText(
    'Grill · Break at 18:10 before the rush · Nobody will work at the grill during the break.',
  );
  const actions = page.locator('#board-form > .actions');
  const bounds = async () => {
    const box = await actions.boundingBox();
    expect(box?.y).toBeGreaterThan(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
    if (!box) throw new Error('Missing board action bar');
    return box;
  };
  await bounds();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const selim = page.locator('[data-board-cook="selim"]');
  const dilek = page.locator('[data-board-cook="dilek"]');
  await selim.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(selim.locator('.board-fields')).toBeVisible();
  await dilek.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(selim.locator('.board-fields')).toBeHidden();
  await expect(dilek.locator('.board-fields')).toBeVisible();
  await dilek.getByRole('button', { name: '21:00 after the rush', exact: true }).click();
  await expect(page.locator('#ask-board')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#open-service')).toBeDisabled();
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-b', '20px'));
  await bounds();
  const answer = dilek.locator('.board-answer');
  await answer.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await answer.boundingBox();
  const bar = await bounds();
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(bar.y);
  const open = await page.locator('#open-service').boundingBox();
  expect((open?.y ?? 0) + (open?.height ?? 0)).toBeLessThanOrEqual(670);
  await page.locator('#ask-board').click();
  await expect(page.locator('#open-service')).toBeEnabled();
  await bounds();
});

test('switching cooks keeps the tapped control visible and preserves unanswered edits', async ({ page }) => {
  await start(page);
  const selim = page.locator('[data-board-cook="selim"]');
  const dilek = page.locator('[data-board-cook="dilek"]');
  await selim.getByRole('button', { name: 'Change', exact: true }).click();
  await selim.getByRole('button', { name: '21:00 after the rush', exact: true }).click();
  const change = dilek.getByRole('button', { name: 'Change', exact: true });
  await change.evaluate((button) => window.scrollBy(0, button.getBoundingClientRect().top - 20));
  await change.click();
  await expect(dilek.getByRole('button', { name: 'Done', exact: true })).toBeInViewport({ ratio: 1 });
  await selim.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(selim.getByRole('button', { name: '21:00 after the rush', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const chip of await selim.locator('.board-chips button').all()) {
    await chip.scrollIntoViewIfNeeded();
    const rect = await chip.boundingBox();
    const bar = await page.locator('#board-form > .actions').boundingBox();
    expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
  }
});
