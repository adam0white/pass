import { expect, test } from '@playwright/test';

for (const checked of [false, true]) {
  test(`share intent ${checked} applies at submit without a separate history choice`, async ({ page }) => {
    await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/');
    await page.evaluate(async () => {
      const { openFeedback } = await new Function('return import("/src/ui/feedback.ts")')();
      const target = window as unknown as { choices: boolean[]; notes: unknown[] };
      target.choices = [];
      target.notes = [];
      const lab = {
        game: 'pass',
        telemetryOn: false,
        privacySignalOn: true,
        privacyOverride: false,
        sendFeedback: async (...args: unknown[]) => {
          target.notes.push(args);
          return 'queued';
        },
      };
      openFeedback({
        lab,
        getRun: () => ({ seed: 7 }),
        download() {},
        onBack() {},
        chooseRecording: (allow: boolean) => target.choices.push(allow),
      });
    });
    await page.evaluate(() => document.fonts.ready);
    const sheet = page.locator('.pass-feedback');
    await expect(sheet.locator('textarea')).not.toHaveAccessibleName(/Share this run/);
    const checkbox = sheet.getByRole('checkbox', {
      name: 'Share this run and my play with the lab',
      exact: true,
    });
    expect(await checkbox.isChecked()).toBe(false);
    if (checked) await checkbox.check();
    expect(await page.evaluate('window.choices')).toEqual([]);
    await sheet.locator('textarea').fill('QA feedback-frictionless');
    await sheet.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect.poll(() => page.evaluate('window.notes.length')).toBe(1);
    expect(await page.evaluate('window.notes[0][1].sharePlay')).toBe(checked);
  });
}
