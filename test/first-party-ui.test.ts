import { expect, it } from 'vitest';
import { planOf } from '../src/sim/campaign.ts';
import { beginAtWeekTwo, firstPartyBoard, runToSeating } from '../src/sim/firstweek.ts';
import { boardDefaults, cookingStep, queueInput } from '../src/sim/kitchen.ts';
import { handoverContext, sundayOpenLabel } from '../src/ui/first-party.ts';

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

it('names the inherited portion and its cooking step without changing the notebook', () => {
  const s = beginAtWeekTwo(42);
  queueInput(s, { kind: 'open' });
  const target = firstPartyBoard(s);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  runToSeating(s, target);
  const before = JSON.stringify(s);
  expect(handoverContext(s)).toContain('The steady hand ran the service until now.');
  const act = cookingStep(s);
  expect(s.help).toBeTruthy();
  expect(act).toBeTruthy();
  expect(handoverContext(s)).toContain('You take over table');
  expect(handoverContext(s)).toContain('grill portion');
  expect(handoverContext(s)).toContain(act?.text);
  expect(JSON.stringify(s)).toBe(before);
});

it('names empty hands and the reserved next portion at handover', () => {
  const s = beginAtWeekTwo(42);
  expect(handoverContext(s)).toBe('The steady hand ran the service until now. Your hands are empty.');
  s.chefNext = { ticket: 999, station: 'oven' };
  const ticket = s.tickets[0];
  if (!ticket) throw new Error('Expected a completed table');
  s.tickets.push({ ...ticket, id: 999, table: 4 });
  expect(handoverContext(s)).toBe(
    'The steady hand ran the service until now. Your hands are empty. Chef’s next: table 4’s pide.',
  );
});
