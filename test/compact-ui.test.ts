import { expect, it } from 'vitest';
import {
  boardDefaults,
  cloneState,
  exportRun,
  helpOptions,
  newGame,
  queueInput,
  replay,
  step,
} from '../src/sim/kitchen.ts';
import { compactRun } from '../src/ui/run.ts';

it('compact notebook run preserves edition, inputs and exact elapsed minute for replay', () => {
  for (const edition of ['pass@3', 'pass@4', 'pass@5', 'pass@6']) {
    const s = newGame(42, edition);
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    }
    for (let i = 0; i < 71; i++) step(s);
    const compact = compactRun(exportRun(s, '2.8.0'));
    expect(compact).not.toHaveProperty('state');
    expect(compact.framework).toBe('2.8.0');
    expect(compact.game).toBe(edition);
    expect(cloneState(replay(compact.seed, compact.inputs, compact.minute, compact.game))).toEqual(
      cloneState(s),
    );
  }
});

it('compact replay retains an immediately reserved portion and continues identically', () => {
  const s = newGame(42);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (!helpOptions(s).length) step(s);
  const option = helpOptions(s)[0];
  if (!option) throw new Error('Expected waiting work');
  queueInput(s, { kind: 'help', ticket: option.ticket, station: option.station });
  expect(s.help).toBeTruthy();
  const compact = compactRun(exportRun(s, '2.8.0'));
  const resumed = replay(compact.seed, compact.inputs, compact.minute, compact.game);
  expect(cloneState(resumed)).toEqual(cloneState(s));
  for (let i = 0; i < 8; i++) {
    step(s);
    step(resumed);
  }
  expect(cloneState(resumed)).toEqual(cloneState(s));
});
