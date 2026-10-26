import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { boardDefaults, newGame, queueInput, step } from '../../src/sim/kitchen.ts';

async function load(page: Page, night: number, evening = false) {
  const s = newGame(42);
  while (s.night < night || (evening && s.phase !== 'evening')) {
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    } else if (s.phase === 'evening') queueInput(s, { kind: 'open' });
    else step(s);
  }
  await page.route('**/lab/api/**', (route) => route.abort());
  await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem('pass-save-v3')) localStorage.setItem('pass-save-v3', JSON.stringify(save));
    },
    { game: s.version, seed: s.seed, inputs: s.inputs, minute: s.minute, pages: [] },
  );
  await page.goto('/');
  await page.locator('#cont').click();
}

for (const [width, height] of [
  [360, 690],
  [1280, 800],
] as const) {
  test(`complete board agreements and cover answers at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await load(page, 3);
    const selim = page.locator('.board-row[data-board-cook="selim"]');
    await selim.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('button', { name: 'Dilek', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('#ask-board').click();
    await expect(selim.locator('.board-summary')).toContainText('not agreed');
    const text = page.locator('.board-row .board-answer, .board-row .board-summary');
    for (const block of await text.all()) {
      await block.scrollIntoViewIfNeeded();
      const size = await block.evaluate((el) => ({
        h: el.clientHeight,
        fullH: el.scrollHeight,
        w: el.clientWidth,
        fullW: el.scrollWidth,
      }));
      expect(size.fullH).toBeLessThanOrEqual(size.h + 1);
      expect(size.fullW).toBeLessThanOrEqual(size.w + 1);
    }
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: test.info().outputPath(`board-${width}.png`) });
    await expect(page.locator('#open-service')).toBeInViewport({ ratio: 1 });
  });

  test(`Rafi's existing jar reply is visible and survives reload at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await load(page, 3, true);
    await page.getByRole('button', { name: 'Sit with Rafi on the back step' }).click();
    const response = page.getByRole('status').filter({ hasText: 'I sat with Rafi on the back step.' });
    await expect(response).toContainText('When the jar tempts me, I’ll go and scrub the trays. Okay, Chef.');
    try {
      await expect(response).toBeInViewport({ ratio: 1 });
    } finally {
      const geometry = await response.evaluate((el) => {
        const rect = (node: Element) => {
          const r = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            tag: node.tagName,
            id: node.id,
            className: node.className,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            scrollTop: node.scrollTop,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
            overflow: style.overflow,
            padding: style.padding,
            scrollMargin: style.scrollMargin,
          };
        };
        const ancestors = [];
        for (let node = el.parentElement; node; node = node.parentElement) ancestors.push(rect(node));
        return {
          text: el.textContent,
          response: rect(el),
          ancestors,
          viewport: { width: innerWidth, height: innerHeight },
          fonts: document.fonts.status,
        };
      });
      await mkdir(test.info().outputDir, { recursive: true });
      await writeFile(test.info().outputPath('jar-geometry.json'), JSON.stringify(geometry, null, 2));
    }
    await expect(page.locator('#open')).toBeEnabled();
    if (process.env.PASS_SCREENSHOTS === '1')
      await page.screenshot({ path: test.info().outputPath(`rafi-${width}.png`) });
    await page.reload();
    await page.locator('#cont').click();
    await expect(response).toContainText('When the jar tempts me, I’ll go and scrub the trays. Okay, Chef.');
    await expect(page.locator('#open')).toBeEnabled();
  });
}
