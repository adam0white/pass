import fs from 'node:fs';
import { diffChronicle, promise, promptingLine } from '@adam0white/human-framework-legacy';
import { expect, it } from 'vitest';
import { replayExport } from '../src/sim/continuation.ts';
import { advance } from '../src/sim/host-policy.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  personOf,
  queueInput,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';
import { compactRun } from '../src/ui/run.ts';

it('opts into authored kitchen verbs through the published chronicle narrator', () => {
  const p = personOf(newGame(42, 'pass@16'), 'dilek');
  expect(p.lexicon?.actions?.cold?.past).toBe('worked at the cold side');
  const old = JSON.parse(
    fs.readFileSync(new URL('./fixtures/narration-pass@15-before.json', import.meta.url), 'utf8'),
  );
  const day = old.state.people.find((x: { id: string }) => x.id === 'dilek').chronicleDay;
  const a = { ...day, trust: [], mood: 0, day: 0, actions: [{ action: 'cold', done: 1, by: { chef: 1 } }] };
  const b = { ...day, trust: [], mood: 0, day: 1, actions: [{ action: 'cold', done: 1, by: {} }] };
  const narrated = diffChronicle([a], [b], { person: p, voices: ['chef'] });
  expect(narrated.lines.join(' ')).toContain('worked at the cold side');
  expect(narrated.lines.join(' ')).not.toContain('colded');
});
it('preserves one complete raw continuation of every existing edition', () => {
  for (const edition of ['pass@13', 'pass@14', 'pass@15']) {
    const read = (suffix: string) =>
      JSON.parse(
        fs.readFileSync(new URL(`./fixtures/narration-${edition}-${suffix}.json`, import.meta.url), 'utf8'),
      );
    const full = read('before');
    const s = replayExport(full);
    expect(cloneState(s)).toEqual(full.state);
    for (let i = 0; i < 30; i++) step(s);
    expect(cloneState(s)).toEqual(read('after'));
  }
});
it('retains the new opt-in marker in full/native compact/import and 30 actual runtime steps', () => {
  const s = newGame(42, 'pass@16');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 35; i++) step(s);
  expect(s.narration?.v).toBe(1);
  const full = exportRun(s, '3.0.0');
  for (const file of [full, compactRun(full)]) {
    const loaded = replayExport(JSON.parse(JSON.stringify(file)));
    expect(cloneState(loaded)).toEqual(cloneState(s));
    const actual = restoreState(cloneState(s));
    for (let i = 0; i < 30; i++) {
      step(loaded);
      step(actual);
    }
    expect(cloneState(loaded)).toEqual(cloneState(actual));
    expect(loaded.version).toBe('pass@16');
  }
  expect(newGame(42).version).toBe('pass@13');
});
it('published prompting outcome controls are distinct literal third-person captions', () => {
  const options = { plainEnglish: true, voice: 'third' } as const;
  expect(promptingLine('inclination', 'turned', 'redirect', options)).toContain('chose something else');
  expect(promptingLine('inclination', 'assented', undefined, options)).toContain('acted on it');
  expect(promptingLine('inclination', 'passed', undefined, options)).toContain('without action');
});

function service() {
  const s = newGame(42, 'pass@16');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 12; i++) step(s);
  return s;
}
function callDuringWork(s: ReturnType<typeof service>, label = 'my call home', from?: number) {
  const p = personOf(s, 'dilek');
  promise(p, {
    kind: 'promise',
    toId: 'self',
    label,
    actions: ['phone'],
    from: from ?? s.minute,
    until: s.minute + 4,
    importance: 0.1,
  });
  return p;
}
it('names actual started ordered work in the evening without rewriting raw review facts', () => {
  const s = service();
  const p = callDuringWork(s);
  queueInput(s, { kind: 'ask', cook: 'dilek', verb: 'grill', insist: true });
  step(s);
  expect(p.activity?.affordanceId).toBe('grill');
  expect(p.activity?.suggestion?.verdict).toBe('complied');
  while (s.phase === 'service') step(s);
  expect(
    s.narration?.causes.some((x) => x.who === 'dilek' && x.label === 'my call home' && x.cause === 'ordered'),
  ).toBe(true);
  expect(p.review?.last?.missed).toContain('my call home');
  expect(s.reports.at(-1)?.reviews.find((x) => x.id === 'dilek')?.line).toMatch(/following an order/);
});
it('does not assign an unrelated earlier order to a later missed commitment', () => {
  const s = service();
  const p = callDuringWork(s, 'my later call', s.minute + 2);
  // Her cold-side rota began before this new commitment; no new work is requested.
  while (s.phase === 'service') step(s);
  expect(p.review?.last?.missed).toContain('my later call');
  expect(s.narration?.causes.some((x) => x.label === 'my later call')).toBe(false);
  expect(s.reports.at(-1)?.reviews.find((x) => x.id === 'dilek')?.line).not.toMatch(
    /following an order|being interrupted/,
  );
});
it('a pending request and an actual refusal supply no ordered-cause evidence', () => {
  const s = service();
  callDuringWork(s);
  queueInput(s, { kind: 'ask', cook: 'selim', verb: 'dish', insist: true });
  // queueInput applies this request now, but no accepted work interval has elapsed.
  expect(s.narration?.causes).toEqual([]);
  let refused = false;
  for (let i = 0; i < 80 && !refused; i++) {
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'dish', insist: true });
    step(s);
    refused = s.lastAnswer?.verdict === 'refused';
  }
  expect(refused).toBe(true);
  expect(s.narration?.causes.some((x) => x.who === 'selim' && x.cause === 'ordered')).toBe(false);
});

it('names interruption only when the interrupted activity matched the missed commitment', () => {
  const s = service();
  const p = personOf(s, 'dilek');
  expect(p.activity?.action).toBe('cold');
  if (!p.activity) throw new Error('The cold-side activity did not start.');
  promise(p, {
    kind: 'promise',
    toId: 'self',
    label: 'my cold preparation',
    actions: ['cold'],
    from: p.activity.startedAt,
    until: s.minute + 4,
    importance: 0.1,
  });
  queueInput(s, { kind: 'ask', cook: 'dilek', verb: 'grill', insist: true });
  step(s);
  expect(p.activity?.action).toBe('grill');
  while (s.phase === 'service') step(s);
  expect(p.review?.last?.missed).toContain('my cold preparation');
  expect(
    s.narration?.causes.some((x) => x.label === 'my cold preparation' && x.cause === 'interrupted'),
  ).toBe(true);
  expect(s.reports.at(-1)?.reviews.find((x) => x.id === 'dilek')?.line).toContain('being interrupted');
});
it('uses published plain prompting captions for actual HF records in service', () => {
  const s = service();
  while (!(s.night === 3 && s.phase === 'evening')) advance(s, 'ask', 'promise-none');
  queueInput(s, { kind: 'jar', choice: 'talk' });
  queueInput(s, { kind: 'open' });
  const phase = () => s.phase;
  while (phase() === 'board') advance(s, 'ask', 'promise-none');
  while (phase() === 'service') step(s);
  const captions = s.said.filter((x) => x.kind === 'prompt');
  expect(captions.length).toBeGreaterThan(0);
  expect(captions.every((x) => x.text.includes('felt an urge.'))).toBe(true);
  expect(
    captions.some(
      (x) =>
        x.text.includes('acted on it') ||
        x.text.includes('let it pass') ||
        x.text.includes('without action') ||
        x.text.includes('did not act'),
    ),
  ).toBe(true);
});

it('names the matching interruption from an actual accepted chef conversation', () => {
  const s = newGame(42, 'pass@16');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 30; i++) step(s);
  const p = personOf(s, 'dilek');
  expect(p.activity?.action).toBe('cold');
  if (!p.activity) throw new Error('The cold-side activity did not start.');
  promise(p, {
    kind: 'promise',
    toId: 'self',
    label: 'my cold preparation',
    actions: ['cold'],
    from: p.activity.startedAt,
    until: s.minute + 1,
    importance: 0.1,
  });
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'check-in' });
  step(s);
  expect(p.activity?.action).toBe('conversation');
  expect(p.activity?.suggestion?.verdict).toBe('assented');
  while (s.phase === 'service') step(s);
  expect(p.review?.last?.missed).toContain('my cold preparation');
  expect(
    s.narration?.causes.some((x) => x.label === 'my cold preparation' && x.cause === 'interrupted'),
  ).toBe(true);
  expect(s.reports.at(-1)?.reviews.find((x) => x.id === 'dilek')?.line).toContain('being interrupted');
});
