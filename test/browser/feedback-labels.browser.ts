import { expect, test } from '@playwright/test';

// Actual host renderer and installed SDK; task-local mocked HTTP receipt only.
for (const [width, height] of [
  [360, 690],
  [1280, 800],
] as const)
  test(`ordinary labels preserve edited notes and send only on explicit Submit at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/lab/api/**', (route) => route.abort());
    await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
    await page.goto('/');
    await page.evaluate(async () => {
      const target = window as unknown as { feedbackRequests: unknown[] };
      target.feedbackRequests = [];
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        if (String(input) === `${location.origin}/feedback-mock/run`) {
          const body = init?.body as Blob;
          const text = await new Response(body.stream().pipeThrough(new DecompressionStream('gzip'))).text();
          target.feedbackRequests.push(JSON.parse(text));
          return new Response(JSON.stringify({ id: 'mock-note-receipt' }), { status: 200 });
        }
        return originalFetch(input, init);
      };
      const { openFeedback } = await new Function('return import("/src/ui/feedback.ts")')();
      const { createLab } = await new Function('return import("/@id/@adam0white/lab-client")')();
      const lab = createLab({
        game: 'pass-feedback-control',
        endpoint: `${location.origin}/feedback-mock`,
        captureErrors: false,
        sendFromLocalhost: true,
        build: { commit: 'mock', framework: '3.0.0', app: '0.1.0' },
      });
      lab.setEventsOff(true);
      openFeedback({
        lab,
        getRun: () => ({ secretRunMarker: 'excluded-run' }),
        download() {},
        onBack() {},
        chooseRecording() {},
      });
    });
    const sheet = page.locator('.pass-feedback');
    const stop = sheet.getByRole('button', { name: "I'm stopping", exact: true });
    const confused = sheet.getByRole('button', { name: "I'm confused", exact: true });
    await expect(stop).toBeVisible();
    await stop.click();
    const note = sheet.locator('textarea');
    await expect(note).toHaveValue("I'm stopping");
    await note.fill("I'm stopping because the plan is unclear.");
    await confused.click();
    await expect(note).toHaveValue("I'm confused\n\nI'm stopping because the plan is unclear.");
    await confused.click();
    await expect(note).toHaveValue("I'm stopping because the plan is unclear.");
    await stop.click();
    await confused.click();
    await expect(note).toHaveValue("I'm confused\n\nI'm stopping because the plan is unclear.");
    expect(await page.evaluate('window.feedbackRequests')).toEqual([]);
    await expect(sheet.getByRole('checkbox')).not.toBeChecked();
    await sheet.locator('.feedback-name summary').click();
    await sheet.locator('[name="tester-name"]').fill('SDK renderer control');
    await sheet.getByRole('button', { name: 'Not sure', exact: true }).click();
    const submit = sheet.getByRole('button', { name: 'Submit', exact: true });
    await submit.scrollIntoViewIfNeeded();
    expect((await submit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await submit.click();
    await expect(sheet.locator('.feedback-status')).toContainText('mock-note-receipt');
    const requests = await page.evaluate(
      () => (window as unknown as { feedbackRequests: unknown[] }).feedbackRequests,
    );
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests)).toContain('Verdict: mixed');
    expect(JSON.stringify(requests)).not.toContain('excluded-run');
    expect(requests[0]).toMatchObject({
      note: "Verdict: mixed\n\nI'm confused\n\nI'm stopping because the plan is unclear.",
      run: { feedbackOnly: true },
      name: 'SDK renderer control',
    });
  });
