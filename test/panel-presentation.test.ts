import { expect, it } from 'vitest';
import { newGame } from '../src/sim/kitchen.ts';
import { closingChoices, offerUnavailable } from '../src/ui/people-offers.ts';

it('explains busy and already heard private offers, with an available control', () => {
  const s = newGame(42);
  expect(offerUnavailable(s, 'selim')).toBeNull();
  s.inputs.push({ at: s.minute, kind: 'cast-talk', who: 'selim', choice: 'listen' });
  expect(offerUnavailable(s, 'selim')).toContain('already');
  expect(offerUnavailable(s, 'dilek')).toBeNull();
});
it('explains booked money and lost bookings without claiming a counterfactual', () => {
  const s = newGame(42);
  s.tickets = [
    {
      id: 1,
      table: 1,
      at: 1080,
      grill: 1,
      cold: 1,
      oven: 0,
      doneGrill: 1,
      doneCold: 1,
      doneOven: 0,
      patience: 30,
      price: 40,
      status: 'served',
    },
    {
      id: 2,
      table: 2,
      at: 1080,
      grill: 1,
      cold: 1,
      oven: 0,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience: 30,
      price: 40,
      status: 'walked',
    },
  ];
  const text = closingChoices(s);
  expect(text).toContain('₺40');
  expect(text).toContain('Table 2');
  expect(text).toContain('booked');
  expect(text).not.toContain('empty minutes cost');
});

it('names the actual plan and reduced wedding payment in the closing account', () => {
  const s = newGame(42);
  s.board = {
    agreed: true,
    rows: [{ cook: 'selim', station: 'grill', breakAt: 1260, cover: null, accepted: true }],
  };
  s.request = { kind: 'phone', who: 'dilek', at: 1110, state: 'yes' };
  s.tickets = [
    {
      id: 1,
      table: 1,
      at: 1200,
      grill: 1,
      cold: 0,
      oven: 0,
      doneGrill: 1,
      doneCold: 0,
      doneOven: 0,
      patience: 100,
      price: 1000,
      due: 1200,
      status: 'served',
      servedAt: 1210,
    },
  ];
  expect(closingChoices(s)).toContain('Selim agreed to the grill');
  expect(closingChoices(s)).toContain('21:00');
  expect(closingChoices(s)).toContain('you said yes');
  expect(closingChoices(s)).toContain('₺550 paid, ₺450 less than agreed');
});
