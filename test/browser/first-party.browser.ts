import { expect, test } from '@playwright/test';

test('first party start shows both Sunday choices and hands over after the player opens its board', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:01:00Z'));
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin at the first party', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Next week’s parties' });
  await expect(nav).toBeInViewport({ ratio: 1 });
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await links.nth(i).click();
    const href = await links.nth(i).getAttribute('href');
    const card = page.locator(href ?? 'missing');
    await card.getByRole('button', { name: 'Promise it', exact: true }).click();
  }
  // Reload on Sunday must preserve the shortcut intent.
  await page.reload();
  await page.locator('#cont').click();
  await page.getByRole('button', { name: 'Open on Wednesday', exact: true }).click();
  await expect(page.locator('#board-form')).toBeVisible();
  await page.locator('#open-service').click();
  await expect(page.locator('#caption')).toContainText('You promised');
  await expect(page.locator('#caption')).toContainText('You have the pass.');
  await page.reload();
  await page.locator('#cont').click();
  await expect(page.locator('#caption')).toContainText('You have the pass.');
  await page.screenshot({ path: '/Users/abdul/code/.lab-scratch/labplay-fix/pass/first-party-phone.png' });
});
