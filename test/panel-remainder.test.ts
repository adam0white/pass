/** Scope: public kitchen facts and complete agreement presentation only.
 * No new faculty, private observation, predicted choice or prayer ruling is added.
 */
import { expect, it } from 'vitest';
import { boardDefaults, cloneState, newGame, queueInput } from '../src/sim/kitchen.ts';
import { agreementStatus, cookRequestWarning, publicPrayerPlan } from '../src/ui/request-context.ts';

it('warns from actual station coverage and the public authored prayer window without changing state', () => {
  const s = newGame(42, 'pass@19');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const before = JSON.stringify(cloneState(s));
  expect(cookRequestWarning(s, 'selim')).toContain('only cook at the grill');
  expect(cookRequestWarning(s, 'selim')).toContain('can leave the grill empty');
  expect(publicPrayerPlan(s, 'selim')).toContain('18:35–19:20');
  expect(publicPrayerPlan(s, 'dilek')).toBe('');
  expect(publicPrayerPlan(s, 'selim')).not.toMatch(/will pray|will miss|must/);
  expect(JSON.stringify(cloneState(s))).toBe(before);
});

it('keeps the station and cover answers distinct even when one cook refuses relief', () => {
  const s = newGame(42, 'pass@19');
  const row = { ...boardDefaults(s)[0]!, accepted: true, cover: 'dilek', coverAccepted: false };
  expect(agreementStatus(s, row, false)).toBe('Selim agreed. Dilek has not agreed to cover.');
  expect(agreementStatus(s, { ...row, accepted: false }, false)).toBe(
    'Selim refused or asked for a change. Dilek has not agreed to cover.',
  );
  expect(agreementStatus(s, row, true)).toBe(
    'Waiting for a new answer from Selim. The previous answer is below.',
  );
});
