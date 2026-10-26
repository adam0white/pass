import { expect, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput } from '../../src/sim/kitchen.ts';

test.beforeEach(async ({ page }) => {
  const s = newGame(42);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  await page.clock.install();
  await page.addInitScript(
    (save) => {
      localStorage.setItem('hf-lab-recording-off', '1');
      localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    { game: s.version, seed: s.seed, inputs: s.inputs, minute: s.minute, pages: [] },
  );
  await page.goto('/');
  await page.locator('#cont').click();
});

test('quiet service exposes agreements and dates its journal without opening the introduction', async ({
  page,
}) => {
  await expect(page.locator('.journal details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.journal > .hand').first()).toContainText('grill until 18:10');
  await expect(page.locator('.journal > .hand').last()).toContainText('cold side until 18:35');
  await expect(page.locator('.journal > .hand').first().locator('time')).toHaveText('17:25');
  await page.locator('.journal summary').click();
  await page.clock.runFor(1000);
  await expect(page.locator('.journal details')).toHaveAttribute('open', '');
});

test('counter-offer names its cook and a non-station activity explains their whereabouts', async ({
  page,
}) => {
  const otherCook = await page.locator('[data-pick="dilek"]').boundingBox();
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const { _debug } = await import(path);
    // UI-only fixture: simulate a recorded answer and current prayer, without altering rules.
    const s = _debug.state;
    s.lastAnswer = {
      who: 'selim',
      at: s.minute,
      text: 'Let me pray first, Chef.',
      verdict: 'modified',
      counter: 'dish',
    };
    _debug.step(1);
    const simPath = '/src/sim/kitchen.ts';
    const { personOf } = await import(simPath);
    const activity = personOf(s, 'selim').activity;
    if (!activity) throw new Error('Expected activity');
    activity.affordanceId = 'pray';
    activity.affordance.label = 'praying';
    _debug.draw();
  });
  expect(await page.locator('[data-pick="dilek"]').boundingBox()).toEqual(otherCook);
  await expect(page.locator('[data-counter]')).toContainText('Selim');
  await page.locator('[data-pick="selim"]').click();
  await expect(page.locator('.station-duration')).toContainText(/praying.*storeroom/);
  await expect(page.locator('.panel-reply')).toContainText('Let me pray first');
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const { _debug } = await import(path);
    const s = _debug.state;
    s.said.push({ ...s.lastAnswer, kind: 'answer' });
    s.lastAnswer = { who: 'dilek', at: s.minute, text: 'Fine.', verdict: 'assented' };
    _debug.draw();
  });
  await expect(page.locator('.panel-reply')).toContainText('Let me pray first');
});
