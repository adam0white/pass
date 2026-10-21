// Headless balance measure: policy bots x seeds -> nights, takings, bills, trust, quits.
// Run: npm run measure -- edition=pass@9 seeds=10 p=flex,flex-chef [pace=nevin]
// Match pass@8 nights with partyNights=7,8,... from the corresponding pass@9 output.
import { pathToFileURL } from 'node:url';
import { planOf } from '../src/sim/campaign.ts';
import { type Arm, advance, type Policy } from '../src/sim/host-policy.ts';

export { type Arm, advance, bot, carefulChef, type Policy, sunday } from '../src/sim/host-policy.ts';

import { activeCrew, type GameState, newGame, personOf, queueInput, trustOf } from '../src/sim/kitchen.ts';

export interface RunOptions {
  edition?: string;
  pace?: 'nevin';
  arm?: Arm;
  /** Fixed scheduled nights from a matched pass@9 run, including nights after an early loss. */
  partyNights?: ReadonlySet<number> | readonly number[];
}

export function simulate(seed: number, policy: Policy, options: RunOptions = {}) {
  const s = newGame(seed, options.edition);
  if (options.pace) queueInput(s, { kind: 'pace', value: options.pace });
  const nightResults: { night: number; served: number; walked: number; takings: number; till: number }[] = [];
  const bookings = new Map<string, NonNullable<GameState['bookings']>[number]>();
  let guard = 0;
  while (s.phase !== 'end') {
    if (++guard > 100000) throw Error(`Safety bound ${s.version}/${seed}/${policy}`);
    const reportCount = s.reports.length;
    advance(s, policy, options.arm);
    for (const booking of s.bookings ?? []) bookings.set(`${booking.week}:${booking.party}`, { ...booking });
    for (const report of s.reports.slice(reportCount)) {
      nightResults.push({
        night: report.night,
        served: report.served,
        walked: report.walked,
        takings: report.takings,
        till: s.till,
      });
    }
  }
  return { state: s, nightResults, bookings: [...bookings.values()] };
}

export function partyAggregate(
  nightResults: ReturnType<typeof simulate>['nightResults'],
  partyNights: ReadonlySet<number> | readonly number[],
) {
  const scheduled = [...new Set(partyNights)].sort((a, b) => a - b);
  const results = nightResults.filter((r) => scheduled.includes(r.night));
  return {
    scheduledNights: scheduled,
    completedNights: results.map((r) => r.night),
    served: results.reduce((n, r) => n + r.served, 0),
    walked: results.reduce((n, r) => n + r.walked, 0),
    takings: results.reduce((n, r) => n + r.takings, 0),
    // Till is a stock, so report each close rather than summing balances.
    tillAtClose: results.map((r) => ({ night: r.night, till: r.till })),
  };
}

export function run(seed: number, policy: Policy, options: RunOptions = {}) {
  const t0 = performance.now();
  const { state: s, nightResults, bookings } = simulate(seed, policy, options);
  const bills = s.reports.filter((r) => r.bill).map((r) => r.bill);
  const partyNights = options.partyNights ?? new Set(bookings.map((b) => b.night));
  return {
    seed,
    policy,
    edition: s.version,
    pace: s.pace ?? 'default',
    arm: options.arm ?? 'promise-none',
    ms: Math.round(performance.now() - t0),
    lost: s.lost,
    finalTill: s.till,
    strikes: s.strikes,
    bills: bills.map((b) => (b ? `${b.paid ? 'paid' : `short ${b.short}`}/${b.amount}` : '')).join(' '),
    weekTakings: [1, 2, 3, 4].map((w) =>
      s.reports.filter((r) => planOf(r.night).week === w).reduce((a, r) => a + r.takings, 0),
    ),
    nights: s.reports.map((r) => `${r.served}/${r.served + r.walked}`).join(' '),
    nightResults,
    bookings,
    promises: s.reports.flatMap((r) => (r.parties ?? []).map((party) => ({ night: r.night, ...party }))),
    partyNights: partyAggregate(nightResults, partyNights),
    crew: activeCrew(s)
      .map((m) => `${m.id}:${trustOf(personOf(s, m.id)).toFixed(2)}`)
      .join(' '),
    left: s.crew
      .filter((m) => m.left)
      .map((m) => m.id)
      .join(','),
    stamps: s.stamps.map((x) => x.id).join(','),
  };
}

export function main(args = process.argv.slice(2)) {
  const option = (key: string) => args.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1);
  const seeds = Number(option('seeds') ?? 10);
  if (!Number.isSafeInteger(seeds) || seeds < 1) throw Error('seeds must be a positive integer');
  const policies = (option('p')?.split(',') ?? [
    'none',
    'ask',
    'insist',
    'care',
    'flex',
    'flex-chef',
  ]) as Policy[];
  const validPolicies: Policy[] = ['none', 'ask', 'insist', 'care', 'flex', 'push', 'flex-chef'];
  for (const policy of policies)
    if (!validPolicies.includes(policy)) throw Error(`Unknown policy: ${policy}`);
  const explicitArms = option('arms')?.split(',') as Arm[] | undefined;
  for (const arm of explicitArms ?? [])
    if (arm !== 'promise-all' && arm !== 'promise-none') throw Error(`Unknown arm: ${arm}`);
  const pace = option('pace');
  if (pace !== undefined && pace !== 'nevin') throw Error(`Unknown pace: ${pace}`);
  const nights = option('partyNights')?.split(',').map(Number);
  if (nights?.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 18)) throw Error('Invalid partyNights');
  for (const policy of policies) {
    const arms: Arm[] =
      explicitArms ?? (policy === 'flex-chef' ? ['promise-all', 'promise-none'] : ['promise-none']);
    for (const arm of arms)
      for (let i = 0; i < seeds; i++)
        console.log(
          JSON.stringify(
            run(1000 + i, policy, {
              edition: option('edition'),
              pace,
              arm,
              partyNights: nights,
            }),
          ),
        );
  }
}

// Importing the policy and runner in parity tests must never start a campaign.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
