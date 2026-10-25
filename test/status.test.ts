import { begin, decide } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { NIGHT_PLANS, nightStart } from '../src/sim/campaign.ts';
import type { Station } from '../src/sim/cooks.ts';
import { cookOf, newGame, personOf, queueInput, type Ticket } from '../src/sim/kitchen.ts';
import { journalWords, serviceStatus, tableAboutToLeave } from '../src/ui/status.ts';

function setup() {
  const s = newGame(42, 'pass@4');
  s.tickets = [];
  for (const c of s.cooks) {
    c.here = true;
    personOf(s, c.id).activity = null;
  }
  return s;
}
function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    table: 1,
    at: 0,
    grill: 1,
    cold: 0,
    oven: 0,
    doneGrill: 0,
    doneCold: 0,
    doneOven: 0,
    patience: 60,
    price: 40,
    status: 'open',
    ...over,
  };
}
function work(s: ReturnType<typeof setup>, id: string, station: Station) {
  const p = personOf(s, id);
  const offer = { id: station, action: station, label: station, duration: 20, effort: 0.5, advertises: {} };
  begin(p, offer, decide(p, [offer]));
}

describe('serviceStatus', () => {
  it('keeps pass@7 agreed station gaps informational', () => {
    const s = setup();
    s.version = 'pass@7';
    s.tickets = [ticket()];
    expect(serviceStatus(s)).toEqual({
      text: 'The grill has nobody in tonight’s plan.',
      needsResponse: false,
    });
  });
  it('prioritizes a named request over a pending job and missing work', () => {
    const s = setup();
    s.tickets = [ticket()];
    s.request = { kind: 'call', who: 'dilek', state: 'asking', at: s.minute };
    cookOf(s, 'selim').pending = {
      s: { voiceId: 'chef', affordanceId: 'grill', strength: 0.5 },
      verb: 'grill',
    };
    expect(serviceStatus(s)).toEqual({ text: 'Dilek is waiting for your answer.', needsResponse: true });
    s.request.state = 'yes';
    expect(serviceStatus(s)).toEqual({ text: 'Waiting for Selim’s answer.', needsResponse: false });
  });

  it('immediately acknowledges a queued ask before the next simulation step', () => {
    const s = setup();
    s.tickets = [ticket()];
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    expect(cookOf(s, 'selim').pending).toBeNull();
    expect(serviceStatus(s)).toEqual({ text: 'Waiting for Selim’s answer.', needsResponse: false });
    s.applied = s.inputs.length;
    expect(serviceStatus(s).needsResponse).toBe(true);
  });

  it('acknowledges a queued answer while preserving unanswered request priority', () => {
    const s = setup();
    s.request = { kind: 'call', who: 'dilek', state: 'asking', at: s.minute };
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    expect(serviceStatus(s)).toEqual({ text: 'Dilek is waiting for your answer.', needsResponse: true });
    queueInput(s, { kind: 'answer', choice: 'yes' });
    expect(s.request.state).toBe('asking');
    expect(serviceStatus(s)).toEqual({ text: 'Waiting for Dilek to respond.', needsResponse: false });
    s.applied = s.inputs.length;
    expect(serviceStatus(s).needsResponse).toBe(true);
  });

  it('names only missing stations and does not count absent cooks as staffing', () => {
    const s = setup();
    s.tickets = [ticket({ cold: 1, oven: 1 })];
    work(s, 'selim', 'grill');
    work(s, 'dilek', 'cold');
    cookOf(s, 'dilek').gone = true;
    expect(serviceStatus(s)).toEqual({
      text: 'The cold side and the oven need a cook.',
      needsResponse: true,
    });
  });

  it('waits when all needed stations are staffed, ignoring finished work', () => {
    const s = setup();
    s.tickets = [ticket({ cold: 1, doneCold: 1 })];
    work(s, 'selim', 'grill');
    expect(serviceStatus(s)).toEqual({
      text: 'Waiting for the cooks to finish the food.',
      needsResponse: false,
    });
  });

  it('distinguishes cold, warming, and hot staffed ovens', () => {
    const s = setup();
    s.tickets = [ticket({ grill: 0, oven: 1 })];
    work(s, 'selim', 'oven');
    expect(serviceStatus(s).text).toBe('The oven is cold. Waiting for it to heat up.');
    s.oven.heat = 0.3;
    expect(serviceStatus(s).text).toBe('Waiting for the oven to heat up.');
    s.oven.heat = 0.8;
    expect(serviceStatus(s).text).toBe('Waiting for the cooks to finish the food.');
  });

  it('reports an active gas outage only when open work needs gas', () => {
    const s = setup();
    const night = NIGHT_PLANS.find((n) => n.gasOut);
    if (!night?.gasOut) throw new Error('Expected a campaign gas outage');
    s.night = night.n;
    s.minute = nightStart(s.night) + night.gasOut.from;
    s.tickets = [ticket({ grill: 0, oven: 1 })];
    expect(serviceStatus(s)).toEqual({
      text: 'Waiting for gas. The grill and the oven are off.',
      needsResponse: false,
    });
    s.tickets = [ticket({ cold: 1, oven: 1 })];
    expect(serviceStatus(s)).toEqual({
      text: 'The cold side needs a cook.',
      needsResponse: true,
    });
    s.tickets = [ticket({ grill: 0, cold: 1 })];
    work(s, 'dilek', 'cold');
    expect(serviceStatus(s).text).toBe('Waiting for the cooks to finish the food.');
  });

  it('distinguishes staffed dish, unstaffed dish, and automatic plate return', () => {
    const s = setup();
    s.night = 2;
    s.tickets = [ticket({ doneGrill: 1 })];
    s.plates = { clean: 0, pile: 1, dirty: [] };
    expect(serviceStatus(s)).toEqual({
      text: 'Food is waiting for clean plates. Choose a cook to wash the dishes.',
      needsResponse: true,
    });
    work(s, 'rafi', 'dish');
    expect(serviceStatus(s)).toEqual({ text: 'Food is waiting for clean plates.', needsResponse: false });
    s.night = 1;
    cookOf(s, 'rafi').gone = true;
    expect(serviceStatus(s)).toEqual({ text: 'Food is waiting for clean plates.', needsResponse: false });
  });

  it('does not require plates for wedding trays', () => {
    const s = setup();
    s.tickets = [ticket({ doneGrill: 1, due: s.minute + 10 })];
    s.plates.clean = 0;
    expect(serviceStatus(s)).toEqual({ text: 'Food is ready for the pass.', needsResponse: false });
  });

  it('reports a ready ticket blocked on plates while another ticket still needs cooking', () => {
    const s = setup();
    s.night = 2;
    s.tickets = [ticket({ doneGrill: 1 }), ticket({ id: 2 })];
    s.plates = { clean: 0, pile: 1, dirty: [] };
    expect(serviceStatus(s)).toEqual({
      text: 'Food is waiting for clean plates. Choose a cook to wash the dishes.',
      needsResponse: true,
    });
    work(s, 'selim', 'grill');
    work(s, 'rafi', 'dish');
    expect(serviceStatus(s)).toEqual({ text: 'Food is waiting for clean plates.', needsResponse: false });
  });

  it('distinguishes the next ticket from closing and ignores completed tickets', () => {
    const s = setup();
    s.tickets = [ticket({ status: 'served' }), ticket({ id: 2, status: 'waiting', at: s.minute + 10 })];
    expect(serviceStatus(s)).toEqual({ text: 'Waiting for the next order.', needsResponse: false });
    s.tickets.pop();
    expect(serviceStatus(s)).toEqual({
      text: 'No orders are waiting. Waiting for closing time.',
      needsResponse: false,
    });
  });

  it('does not mutate state or read hidden skills to choose a cook', () => {
    const s = setup();
    s.tickets = [ticket()];
    const before = JSON.stringify(s);
    expect(serviceStatus(s).text).toBe('The grill needs a cook.');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('display-only service cues', () => {
  it('names only the closest walkout within eight minutes, including apron patience', () => {
    const s = setup();
    s.minute = 100;
    s.tickets = [
      ticket({ at: 49 }),
      ticket({ id: 2, at: 47 }),
      ticket({ id: 3, at: 45, due: 130 }),
      ticket({ id: 4, at: 40, platedAt: 99 }),
      ticket({ id: 5, at: 40, status: 'served' }),
    ];
    const before = JSON.stringify(s);
    expect(tableAboutToLeave(s)).toBe(2);
    expect(JSON.stringify(s)).toBe(before);
    s.apron = 'selim';
    expect(tableAboutToLeave(s)).toBeNull();
    s.apron = null;
    const second = s.tickets[1];
    if (!second) throw new Error('Expected second ticket');
    second.status = 'walked';
    expect(tableAboutToLeave(s)).toBeNull();
    s.minute++;
    expect(tableAboutToLeave(s)).toBe(1);
    s.tickets.push(ticket({ id: 6, at: 49 }));
    expect(tableAboutToLeave(s)).toBe(1);
  });

  it('explains only an autonomous move to the refused board station, without changing the journal', () => {
    const s = setup();
    s.board = {
      agreed: true,
      rows: [{ cook: 'selim', station: 'oven', breakAt: 1200, cover: null, accepted: false, answer: 'No.' }],
    };
    const line = {
      at: s.minute,
      who: 'narrator' as const,
      kind: 'journal' as const,
      text: 'Selim left the grill for the oven, where more was waiting.',
    };
    const before = JSON.stringify(s);
    expect(journalWords(s, line)).toBe(
      'Selim: “I said no to the oven for the whole night. But I can work there for a short time now. I left the grill for the oven, where more was waiting.”',
    );
    expect(JSON.stringify(s)).toBe(before);
    expect(line.text).toBe('Selim left the grill for the oven, where more was waiting.');
    expect(journalWords(s, { ...line, text: 'Selim left the grill for the cold side.' })).toBe(
      'Selim left the grill for the cold side.',
    );
    const row = s.board.rows[0];
    if (!row) throw new Error('Expected board row');
    row.accepted = true;
    expect(journalWords(s, line)).toBe(line.text);
    row.accepted = false;
    expect(journalWords(s, { ...line, kind: 'answer' })).toBe(line.text);
    expect(journalWords(s, { ...line, who: 'selim' })).toBe(line.text);
  });
});
