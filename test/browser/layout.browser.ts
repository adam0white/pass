import { expect, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput } from '../../src/sim/kitchen.ts';

test('people-run board editor holds its draft and keeps the board action in reach', async ({ page }) => {
  await page.goto('/');
  await page.locator('#new').click();
  await page.locator('.board-change').first().click();
  await page.getByRole('button', { name: 'Leave it', exact: true }).click();
  await expect(page.locator('.board-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.board-editor')).toHaveCount(0);
  const action = page.locator('.people-board button.primary');
  await expect(action).toHaveCount(1);
  expect((await action.boundingBox())!.y).toBeLessThan(690);
});

test('automatic service holds for information and queues a held job as insist', async ({ page }) => {
  const s = newGame(42);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  await page.addInitScript(
    (save) => {
      localStorage.setItem('hf-lab-recording-off', '1');
      localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    { game: s.version, seed: s.seed, inputs: s.inputs, minute: s.minute, pages: [] },
  );
  await page.goto('/');
  await page.locator('#cont').click();
  await expect(page.locator('#speed, #clock-rate')).toHaveCount(0);
  await page.getByRole('button', { name: 'Information', exact: true }).click();
  const clock = await page.locator('#clock').textContent();
  await page.waitForTimeout(3100);
  await expect(page.locator('#clock')).toHaveText(clock!);
  await page.keyboard.press('Escape');
  await page.locator('.crew button').first().click();
  const eat = page.locator('[data-v="eat"]');
  await eat.click();
  await expect(page.locator('.panel-reply')).not.toBeEmpty({ timeout: 25000 });
  await expect(eat).toBeEnabled({ timeout: 25000 });
  await eat.dispatchEvent('pointerdown');
  await expect(eat).toHaveClass(/holding/);
  await page.waitForTimeout(500);
  await eat.dispatchEvent('pointerup');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-save-v3')!));
  expect(saved.inputs.at(-1)).toMatchObject({ kind: 'ask', verb: 'eat', insist: true });
});
