import { expect, it } from 'vitest';
import { required } from '../src/required.ts';
import { PRIVATE_CLUES } from '../src/sim/cast-scenes.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { advance } from '../src/sim/host-policy.ts';
import { cloneState, exportRun, newGame, queueInput, step } from '../src/sim/kitchen.ts';
import { openingBoard } from '../src/ui/board.ts';
import { offerUnavailable } from '../src/ui/people-offers.ts';

function open(s: ReturnType<typeof newGame>, careful = false) {
  const rows = openingBoard(s);
  if (careful) for (const row of rows) row.breakAt = row.cook === 'dilek' ? 1185 : 1260;
  queueInput(s, { kind: 'board', rows });
  queueInput(s, { kind: 'open' });
}
it('neglect loses a modest early booking each night; a changed meal plan saves it', () => {
  for (const careful of [false, true]) {
    const s = newGame(42, 'pass@18');
    for (let night = 1; night <= 3; night++) {
      open(s, careful);
      while (s.phase === 'service') step(s);
      const early = s.tickets.find((t) => t.at % 1440 === 1092);
      expect(early, `night ${night}`).toBeDefined();
      expect(early?.status, `night ${night}, careful ${careful}`).toBe(careful ? 'served' : 'walked');
      const report = required(s.reports.at(-1));
      if (!careful) {
        expect(report.walked).toBeGreaterThan(0);
        expect(report.served).toBeGreaterThanOrEqual(s.tickets.length - 4);
      }
      if (night < 3) advance(s, 'none');
    }
    const file = exportRun(s, '3.0.0');
    expect(cloneState(replayExport(file))).toEqual(cloneState(s));
    expect(cloneState(replayExport({ ...file, minute: s.minute, state: undefined }))).toEqual(cloneState(s));
  }
});
it('keeps the historical Monday no-input outcome', () => {
  const s = newGame(42, 'pass@17');
  open(s);
  while (s.phase === 'service') step(s);
  expect(s.reports[0]?.served).toBe(15);
  expect(s.reports[0]?.takings).toBe(600);
});

it('careful service can pay the first bill while neglect still loses Thursday tables', () => {
  const s = newGame(42, 'pass@18');
  for (let turns = 0; turns < 3000 && !(s.night === 6 && s.phase === 'evening'); turns++) {
    if (s.phase === 'board' && s.night <= 3) open(s, true);
    else advance(s, 'flex');
  }
  expect(s.night).toBe(6);
  expect(s.phase).toBe('evening');
  expect(s.strikes).toBe(0);
  expect(s.reports[3]?.walked).toBeGreaterThan(0);
  expect(s.reports.reduce((sum, r) => sum + r.takings, 0)).toBeGreaterThanOrEqual(5200);
});

it('People offers are enabled before opening and after service, and retain the answer', () => {
  const s = newGame(42, 'pass@18');
  expect(offerUnavailable(s, 'selim')).toBeNull();
  open(s);
  expect(offerUnavailable(s, 'selim')).toContain('busy');
  while (s.phase === 'service') step(s);
  expect(offerUnavailable(s, 'selim')).toBeNull();
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'listen' });
  expect(s.said.some((line) => line.who === 'selim' && line.text === PRIVATE_CLUES.selim)).toBe(true);
  expect(offerUnavailable(s, 'selim')).toContain('already heard');
  expect(cloneState(replayExport(exportRun(s, '3.0.0')))).toEqual(cloneState(s));
});
