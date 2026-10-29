import { begin, decide } from '@adam0white/human-framework-legacy';
import { describe, expect, it } from 'vitest';
import { boardDefaults, cookOf, newGame, personOf, queueInput, stationOf, step } from '../src/sim/kitchen.ts';
import { automaticClockPlayback, clockPlayback } from '../src/ui/clock.ts';
import { actionableStaffing, availableStaffing } from '../src/ui/staffing.ts';
import { serviceStatus } from '../src/ui/status.ts';

function movedCook() {
  const s = newGame(42, 'pass@13');
  s.phase = 'service';
  s.tickets = [];
  s.board = {
    agreed: true,
    rows: [{ cook: 'selim', station: 'grill', accepted: true, breakAt: 1200, cover: null }],
  };
  const cook = cookOf(s, 'selim');
  const person = personOf(s, 'selim');
  person.activity = null;
  const work = {
    id: 'cold',
    action: 'cold',
    label: 'cold',
    duration: 40,
    effort: 0.5,
    advertises: {},
  };
  begin(person, work, decide(person, [work]));
  cook.cover = { station: 'cold', until: s.minute + 40 };
  cook.night.events.push({ at: s.minute, verb: 'cold', verdict: 'assented', insisted: false });
  s.staffing = [
    {
      id: 0,
      who: 'selim',
      station: 'grill',
      until: s.minute + 40,
      reason: 'I’m not at my agreed station, Chef.',
      state: 'asking',
    },
  ];
  return s;
}

describe('staffing prompts after an accepted station change', () => {
  it('keeps pass@19 unfillable staffing gaps visible without a prompt', () => {
    const s = newGame(42, 'pass@19');
    s.phase = 'service';
    s.staffing = [
      {
        id: 0,
        who: 'selim',
        station: 'grill',
        until: s.minute + 20,
        reason: 'I need help.',
        state: 'asking',
      },
    ];
    for (const cook of s.cooks) if (cook.id !== 'selim') cook.gone = true;
    expect(actionableStaffing(s)).toHaveLength(1);
    expect(availableStaffing(s)).toEqual([]);
    expect(serviceStatus(s).needsResponse).toBe(false);
  });

  it('suppresses the follow-up after an actual current-edition accepted chef ask', () => {
    const s = newGame(1, 'pass@13');
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    while (s.minute < 1111) step(s);
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'cold' });
    step(s);
    expect(s.lastAnswer?.verdict).toBe('assented');
    expect(stationOf(s, 'selim')).toBe('cold');
    expect(s.staffing?.some((d) => d.who === 'selim' && d.state === 'asking')).toBe(true);
    const before = JSON.stringify(s);
    expect(actionableStaffing(s)).toEqual([]);
    expect(serviceStatus(s).needsResponse).toBe(false);
    expect(automaticClockPlayback(s).rate).toBe(6);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('continues service and playback after the cook accepts the other station', () => {
    const s = movedCook();
    const before = JSON.stringify(s);
    expect(serviceStatus(s).needsResponse).toBe(false);
    expect(clockPlayback(s, 2).rate).toBe(14);
    expect(automaticClockPlayback(s, {}, 2).rate).toBe(14);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps an emergency actionable after the accepted change', () => {
    const s = movedCook();
    const decision = s.staffing?.[0];
    if (!decision) throw new Error('Expected staffing decision');
    decision.reason = 'I need to eat and sit down, Chef.';
    expect(serviceStatus(s).needsResponse).toBe(true);
    expect(clockPlayback(s, 2).rate).toBe(0.1);
    expect(automaticClockPlayback(s, {}, 2).rate).toBe(0.1);
  });

  it('keeps a cook who stops the accepted work actionable', () => {
    const s = movedCook();
    personOf(s, 'selim').activity = null;
    expect(serviceStatus(s).needsResponse).toBe(true);
    expect(clockPlayback(s, 2).rate).toBe(0.1);
  });

  it('keeps an autonomous station change actionable', () => {
    const s = movedCook();
    cookOf(s, 'selim').night.events = [];
    expect(serviceStatus(s).needsResponse).toBe(true);
    expect(clockPlayback(s, 2).rate).toBe(0.1);
  });

  it('recognizes an accepted relief assignment without another chef ask', () => {
    const s = movedCook();
    cookOf(s, 'selim').night.events = [];
    s.staffing?.push({
      id: 1,
      who: 'dilek',
      station: 'cold',
      until: s.minute + 40,
      reason: 'I need to eat and sit down, Chef.',
      state: 'covered',
      cover: 'selim',
    });
    expect(actionableStaffing(s)).toEqual([]);
  });

  it('keeps a departure actionable even while old accepted cover remains', () => {
    const s = movedCook();
    cookOf(s, 'selim').gone = true;
    expect(actionableStaffing(s)).toHaveLength(1);
  });
});
