import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { gloss, lira } from '../src/ui/words.ts';

it('formats money in Turkish lira with English digit grouping', () => {
  expect(lira(5200)).toBe('₺5,200');
  expect(lira(50)).toBe('₺50');
  expect(gloss(lira(5200), true)).toBe('₺5,200 (Turkish lira)');
  expect(gloss('The bill was ₺5200; ₺1000 remained.')).toBe('The bill was ₺5,200; ₺1,000 remained.');
  expect(gloss('₺5,200 (Turkish lira)', true)).toBe('₺5,200 (Turkish lira)');
  const app = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');
  expect(app).not.toMatch(/[₺£]|\bTL\b/u);
  expect(app).toContain('lira(w1.bill)');
  expect(app).toContain('Turkish lira');
});

it('routes every interpolated monetary value through lira instead of a bare number', () => {
  const app = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');
  const monetary =
    /\.(?:amount|takings|till|carry|wage|owes|price)\b|(?:w1|nextWeek)\.bill\b|(?:r\.bill|b)\.short\b|billNow\(|\bper\b/u;
  const expressions = [...app.matchAll(/\$\{([^{}]*)\}/gu)]
    .map((match) => match[1] ?? '')
    .filter((expression) => monetary.test(expression) && !expression.includes('?'));
  expect(expressions.length).toBeGreaterThan(20);
  for (const expression of expressions)
    expect(expression, `Unformatted money: ${expression}`).toMatch(/^lira\(/u);
  for (const amount of [0, 50, 600, 1000, 5200, 6200, 12000]) {
    expect(gloss(`Paid ${lira(amount)}.`)).toBe(`Paid ${lira(amount)}.`);
    expect(lira(amount)).not.toMatch(/£|\bTL\b/u);
    expect(lira(amount)).toMatch(/^₺\d{1,3}(?:,\d{3})*$/u);
  }
});

it('glosses the oven choice consistently without changing its recorded words', () => {
  const recorded = 'Another minute for the crust';
  expect(gloss(recorded)).toBe('Leave it in for the crust');
  expect(gloss(`I chose: ${recorded}.`)).toBe('I chose: Leave it in for the crust.');
  expect(recorded).toBe('Another minute for the crust');
});
