import { describe, expect, it } from 'vitest';
import { HF4_OPENING, kitchenOffer, kitchenPeople, kitchenSpec } from '../src/sim/hf4-authoring.ts';
import { KitchenRun, MINUTE_MS } from '../src/sim/hf4-run.ts';

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fresh = () => new KitchenRun(kitchenSpec(42), kitchenPeople());
const work = () =>
  kitchenOffer('selim', {
    id: 'grill',
    action: 'grill',
    label: 'work at the grill',
    duration: 5,
    effort: 0.4,
    advertises: { competence: 0.3 },
  });

describe('Pass HF4 community run boundary', () => {
  it('continues the same run after restoring a format 5 archive with clipped diagnostics', () => {
    const live = fresh();
    for (let i = 0; i < 70; i++) {
      const at = live.nextInputTime(540);
      live.advance(at, [live.input('offers.received', { person: 'selim', revision: i + 1, offers: [] }, at)]);
    }
    const saved = json(live.checkpoint());
    expect(saved.archive.version).toBe(5);
    expect(saved.archive.history.length).toBeGreaterThan(64);
    expect(saved.archive.current.events).toHaveLength(64);
    const restored = KitchenRun.restore(saved);
    const at = live.nextInputTime(540);
    const restoredAt = restored.nextInputTime(540);
    live.advance(at, [live.input('offers.received', { person: 'selim', revision: 71, offers: [] }, at)]);
    restored.advance(restoredAt, [
      restored.input('offers.received', { person: 'selim', revision: 71, offers: [] }, restoredAt),
    ]);
    expect(json(restored.checkpoint())).toEqual(json(live.checkpoint()));
    expect(restored.verify().verified).toBe(true);
  });
  it('retains accepted work and gives the same complete archive after restore and completion', () => {
    const live = fresh();
    live.decide('selim', [work()], 540);
    expect(live.active.map((a) => a.offer.id)).toEqual(['grill']);
    const file = json(live.checkpoint());
    expect(file.archive.history.every((transaction) => transaction.fidelity.mode === 'daily')).toBe(true);
    const restored = KitchenRun.restore(file);
    const until = live.now + 6 * MINUTE_MS;
    live.advance(until);
    restored.advance(until);
    expect(json(restored.checkpoint())).toEqual(json(live.checkpoint()));
    expect(
      restored.checkpoint().archive.history.every((transaction) => transaction.fidelity.mode === 'daily'),
    ).toBe(true);
    expect(live.active).toEqual([]);
    const verified = live.verify();
    expect(verified.verified).toBe(true);
    expect(verified.fullHash).toBe(live.checkpoint().archive.hashes.full);
  });
  it('preserves an unresolved start identity and settles the restored frame once', () => {
    const live = fresh();
    const at = HF4_OPENING + 1;
    const offer = work();
    const frame = live.boundary(at, [
      live.input('offers.received', { person: 'selim', revision: 1, offers: [offer] }, at),
      live.input(
        'decision.requested',
        { person: 'selim', reason: 'opening work', treatment: 'ordinary', offerRevision: 1 },
        at,
      ),
    ]);
    expect(frame.boundary.type).toBe('world-required');
    const saved = json(live.checkpoint());
    const restored = KitchenRun.restore(saved);
    expect(restored.checkpoint().pending?.boundary).toEqual(frame.boundary);
    // Neither world has accepted a start. Availability can now refuse the same request.
    live.advance(
      at,
      [],
      { available: () => false, outcome: () => ({ exposures: [], observedProgress: [] }) },
      frame,
    );
    restored.advance(at, [], {
      available: () => false,
      outcome: () => ({ exposures: [], observedProgress: [] }),
    });
    expect(json(restored.checkpoint())).toEqual(json(live.checkpoint()));
  });
  it('keeps a distinct persisted ingress time for inputs in one displayed minute', () => {
    const live = fresh();
    live.decide('selim', [work()], 540);
    const first = live.now;
    live.decide(
      'dilek',
      [
        kitchenOffer('dilek', {
          id: 'cold',
          action: 'cold',
          label: 'work at the cold side',
          duration: 5,
          effort: 0.3,
          advertises: {},
        }),
      ],
      540,
    );
    expect(live.now).toBeGreaterThan(first);
    const restored = KitchenRun.restore(json(live.checkpoint()));
    expect(restored.nextInputTime(540)).toBe(live.now + 1);
    expect(live.verify().verified).toBe(true);
  });
  it('leaves the complete archive unchanged during self inspection and preview', () => {
    const live = fresh();
    const before = json(live.checkpoint());
    live.inspect({
      perspective: { kind: 'person', observer: 'selim' },
      people: ['selim'],
      select: ['summary', 'body', 'skills', 'relationships', 'agenda', 'events'],
    });
    live.preview({
      perspective: { kind: 'person', observer: 'selim' },
      person: 'selim',
      until: HF4_OPENING,
      inputs: [],
    });
    expect(json(live.checkpoint())).toEqual(before);
  });
});
