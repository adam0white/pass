import { expect, test } from '@playwright/test';
import { boardDefaults, newGame, PEOPLE_RUN_NOTE, queueInput, step } from '../../src/sim/kitchen.ts';

test('continuing a chef notebook migrates once and keeps the cook controls', async ({ page }) => {
  const s = newGame(42, 'pass@10');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 20; i++) step(s);
  await page.clock.install({ time: new Date('2026-10-21T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-21T12:01:00Z'));
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem('pass-save-v3')) localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    {
      game: s.version,
      seed: s.seed,
      inputs: s.inputs,
      minute: s.minute,
      pages: [],
    },
  );
  const notes: string[] = [];
  page.on('dialog', async (dialog) => {
    notes.push(dialog.message());
    await dialog.accept();
  });
  await page.goto('/');
  await page.locator('#cont').click();
  await expect(page.locator('.crew button').first()).toBeVisible();
  await expect(page.locator('#chef-work, [data-ticket], [data-cook-step]')).toHaveCount(0);
  expect(notes).toEqual([PEOPLE_RUN_NOTE]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
  expect(saved.inputs.at(-1).kind).toBe('people-run');
  // Reload must use the migrated input without repeating the note or migrating twice.
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('.crew button').first()).toBeVisible();
  expect(notes).toEqual([PEOPLE_RUN_NOTE]);
});
