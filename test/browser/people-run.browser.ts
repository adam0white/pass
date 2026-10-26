import { expect, test } from '@playwright/test';
import {
  boardDefaults,
  continueThroughPeople,
  newGame,
  PEOPLE_RUN_NOTE,
  priorityOptions,
  queueInput,
  step,
} from '../../src/sim/kitchen.ts';

for (const migrate of [false, true]) {
  test(
    migrate
      ? 'a pinned explicit migration removes chef controls once and reloads exactly'
      : 'legacy continuation retains its chef controls and original replay history',
    async ({ page }) => {
      const s = newGame(42, 'pass@10');
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
      for (let i = 0; i < 20; i++) step(s);
      const priority = priorityOptions(s)[0];
      if (priority) queueInput(s, { kind: 'pass-priority', ticket: priority.ticket });
      if (migrate) expect(continueThroughPeople(s)).toBe(true);
      await page.clock.install();
      await page.addInitScript(
        (save) => {
          if (!localStorage.getItem('pass-save-v3'))
            localStorage.setItem('pass-save-v3', JSON.stringify(save));
        },
        { game: s.version, seed: s.seed, inputs: s.inputs, minute: s.minute, pages: [] },
      );
      await page.goto('/');
      await page.locator('#cont').click();
      await expect(page.locator('.crew button').first()).toBeVisible();
      if (migrate) {
        await expect(page.locator('#chef-work, [data-ticket], [data-cook-step]')).toHaveCount(0);
        await expect(page.locator('.journal')).toContainText(PEOPLE_RUN_NOTE);
      } else {
        await expect(page.locator('#chef-work')).toBeVisible();
        await expect(page.locator('[data-ticket]').first()).toBeVisible();
      }
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3') ?? '{}'));
      expect((await read()).inputs).toEqual(s.inputs);
      await page.reload();
      await page.locator('#cont').click();
      await expect(page.locator('.crew button').first()).toBeVisible();
      expect((await read()).inputs).toEqual(s.inputs);
      expect((await read()).inputs.filter((i: { kind: string }) => i.kind === 'people-run')).toHaveLength(
        migrate ? 1 : 0,
      );
      await expect(page.locator('.run-status')).toHaveCount(0);
    },
  );
}
