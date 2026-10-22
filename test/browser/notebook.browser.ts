import { expect, test } from '@playwright/test';

test('opening voices preserve the default and the tally has no pregame preference', async ({ page }) => {
  await page.goto('/');
  const pace = page.locator('#pace');
  await expect(pace).toHaveText('Selim: “I hope the regulars give us time.”');
  await expect(pace).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pace-note')).toContainText('all month');
  await expect(page.getByText(/Dilek: “Leave it as it is/)).toBeVisible();
  await pace.click();
  await expect(pace).toHaveAttribute('aria-pressed', 'true');
  await pace.click();
  await expect(pace).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#game-menu').click();
  await expect(page.locator('#keep-tally')).toHaveCount(0);
  await page.locator('#menu-back').click();
  const help = page.getByRole('button', { name: 'More about the kitchen', exact: true });
  await help.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#kitchen-help')).toBeVisible();
  await expect(page.locator('#kitchen-help')).toContainText('Hold the job to insist');
  await page.keyboard.press('Escape');
  await expect(page.locator('#kitchen-help')).not.toBeVisible();
  await page.locator('#new').click();
  await expect(page.locator('#ending-tally')).toHaveCount(0);
  const boardHelp = page.getByRole('button', { name: 'About the board', exact: true });
  if (await boardHelp.count()) {
    await boardHelp.click();
    await expect(page.locator('#board-help')).toContainText('Agreed stations last until close');
    await page.keyboard.press('Escape');
  }
  await page.evaluate(async () => {
    const path = '/src/ui/app.ts';
    const app = await import(path);
    if (!app._debug.state) throw new Error('Missing kitchen');
    app._debug.state.phase = 'end';
    app._debug.refresh();
  });
  const tally = page.locator('#ending-tally');
  await expect(page.getByText('See the tally', { exact: true })).toBeVisible();
  await expect(tally).not.toBeVisible();
  await page.getByText('See the tally', { exact: true }).click();
  await expect(tally).toContainText('The kitchen’s tally');
  await expect(tally).toBeVisible();
});
