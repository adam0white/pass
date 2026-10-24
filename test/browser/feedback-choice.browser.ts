import { expect, test } from '@playwright/test';

for (const outcome of ['pending', 'failed']) {
  test(`inline scoped choice ${outcome} cannot grant directly or block the note`, async ({ page }) => {
    await page.route('https://human.adamwhite.work/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/');
    await page.evaluate(async (outcome) => {
      const { openFeedback } = await new Function('return import("/src/ui/feedback.ts")')();
      const target = window as unknown as { choices: boolean[]; grants: boolean[]; notes: unknown[] };
      target.choices = [];
      target.grants = [];
      target.notes = [];
      const lab = {
        game: 'pass',
        personaRecordingRequired: true,
        personaRecordingAllowed: false,
        telemetryOn: true,
        privacySignalOn: false,
        privacyOverride: false,
        allowPersonaRecording: (allow: boolean) => target.grants.push(allow),
        sendFeedback: async (...args: unknown[]) => {
          target.notes.push(args);
          return 'scoped-note';
        },
      };
      openFeedback({
        lab,
        getRun: () => undefined,
        download() {},
        onBack() {},
        chooseRecording: async (allow: boolean) => {
          target.choices.push(allow);
          if (outcome === 'failed') throw new Error('epoch changed');
          await new Promise(() => {});
        },
      });
    }, outcome);
    const sheet = page.locator('.pass-feedback');
    await sheet.getByRole('checkbox', { name: /Link all continuing histories/ }).click();
    await expect.poll(() => page.evaluate('window.choices')).toEqual([true]);
    expect(await page.evaluate('window.grants')).toEqual([]);
    await sheet.locator('textarea').fill('The note still goes.');
    await sheet.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => page.evaluate('window.notes.length')).toBe(1);
  });
}
