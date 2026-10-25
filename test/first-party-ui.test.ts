import { expect, it } from 'vitest';
import { planOf } from '../src/sim/campaign.ts';
import { beginAtWeekTwo, firstPartyBoard, runToSeating } from '../src/sim/firstweek.ts';
import { boardDefaults, cookingStep, queueInput } from '../src/sim/kitchen.ts';
import { handoverContext, handoverHands, sundayOpenLabel } from '../src/ui/first-party.ts';

it('names the first party night and follows the current Sunday promises', () => {
  const s = beginAtWeekTwo(42);
  expect(sundayOpenLabel(s, true)).toBe('Open on Thursday');
  const saturday = s.bookings?.find((b) => b.week === 2 && planOf(b.night).title === 'Saturday');
  if (!saturday) throw new Error('Expected the Saturday party');
  queueInput(s, { kind: 'choose', key: `promise:${saturday.party}`, value: 'promise' });
  expect(sundayOpenLabel(s, true)).toBe('Open on Saturday');
  expect(sundayOpenLabel(s, false)).toBe('Open on Wednesday');
  const thursday = s.bookings?.find((b) => b.week === 2 && planOf(b.night).title === 'Thursday');
  if (!thursday) throw new Error('Expected the Thursday party');
  queueInput(s, { kind: 'choose', key: `promise:${thursday.party}`, value: 'promise' });
  expect(sundayOpenLabel(s, true)).toBe('Open on Thursday');
  queueInput(s, { kind: 'open' });
  expect(firstPartyBoard(s).night).toBe(thursday.night);
});

it('hands over people-run service without a portion or table call', () => {
  const s = beginAtWeekTwo(42);
  queueInput(s, { kind: 'open' });
  const target = firstPartyBoard(s);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  runToSeating(s, target);
  const before = JSON.stringify(s);
  expect(s.help).toBeNull();
  expect(cookingStep(s)).toBeNull();
  expect(handoverContext(s)).toBe(
    'An experienced helper ran the service until now. The cooks make the food and send out the plates. You run the pass.',
  );
  expect(JSON.stringify(s)).toBe(before);
});

it('a save without the hand-over record does not describe the current kitchen as inherited', () => {
  expect(handoverHands(undefined)).toBe('An experienced helper ran the service until you took over.');
  expect(
    handoverHands('An experienced helper ran the service until now. You are not cooking anything.'),
  ).toBe('An experienced helper ran the service until now. You are not cooking anything.');
});
