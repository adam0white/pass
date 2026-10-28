import { expect, test } from '@playwright/test';

test('opening voices preserve the default and the tally has no pregame preference', async ({ page }) => {
  await page.goto('/');
  const pace = page.locator('input[name="pace"][value="nevin"]');
  const normal = page.locator('input[name="pace"][value="normal"]');
  await expect(normal).toBeChecked();
  await expect(pace).not.toBeChecked();
  await expect(
    page.getByText('Nevin’s pace gives customers more time to wait for all four weeks.'),
  ).toBeVisible();
  await pace.check();
  await expect(pace).toBeChecked();
  await normal.check();
  await expect(pace).not.toBeChecked();
  await page.locator('#game-menu').click();
  await expect(page.locator('#keep-tally')).toHaveCount(0);
  await page.locator('#menu-back').click();
  const help = page.getByRole('button', { name: 'Information', exact: true });
  await help.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#phase-help')).toBeVisible();
  await expect(page.locator('#phase-help')).toContainText('Hold the job button to insist');
  await page.keyboard.press('Escape');
  await expect(page.locator('#phase-help')).not.toBeVisible();
  await page.locator('#new').click();
  await expect(page.locator('#ending-tally')).toHaveCount(0);
  const boardHelp = page.getByRole('button', { name: 'Information', exact: true });
  await boardHelp.click();
  await expect(page.locator('#phase-help')).toContainText('If you change the plan');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const app = (window as unknown as { __pass: { state: { phase: string } | null; refresh(): void } })
      .__pass;
    if (!app.state) throw new Error('Missing kitchen');
    app.state.phase = 'end';
    app.refresh();
  });
  const tally = page.locator('#ending-tally');
  await expect(page.getByText('See the tally', { exact: true })).toBeVisible();
  await expect(tally).not.toBeVisible();
  await page.getByText('See the tally', { exact: true }).click();
  await expect(tally).toContainText('The kitchen’s tally');
  await expect(tally).toBeVisible();
});
