import { expect, test } from '@playwright/test';

test('opening voices preserve the default and the tally choice lasts only for this page', async ({
  page,
}) => {
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
  const tally = page.getByRole('checkbox', { name: 'Keep a tally in the notebook' });
  await expect(tally).not.toBeChecked();
  await tally.check();
  await page.locator('#menu-back').click();
  await page.locator('#new').click();
  await expect(page.locator('#ending-tally')).toHaveCount(0);
  await page.locator('#game-menu').click();
  await expect(tally).toBeChecked();
  await page.reload();
  await page.locator('#game-menu').click();
  await expect(tally).not.toBeChecked();
});
