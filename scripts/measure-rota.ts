// Compare an unchanged, plain player policy on both editions. No insistence or tuning.
import {
  boardDefaults,
  cookOf,
  hints,
  newGame,
  onShift,
  owed,
  personOf,
  queueInput,
  staffingOptions,
  stationOf,
  stationsTonight,
  step,
} from '../src/sim/kitchen.ts';

const rows = [];
for (const edition of ['pass@4', 'pass@5']) {
  for (const seed of [7, 21, 42]) {
    const s = newGame(seed, edition);
    const stats = new Map<
      number,
      {
        manualAsks: number;
        boardProposals: number;
        staffingDecisions: number;
        uncoveredDemandMinutes: number;
        rosterGapMinutes: number;
      }
    >();
    const lastAsk = new Map<string, number>();
    const handledStaff = new Set<string>();
    let guard = 0;
    const stat = () => {
      let row = stats.get(s.night);
      if (!row) {
        row = {
          manualAsks: 0,
          boardProposals: 0,
          staffingDecisions: 0,
          uncoveredDemandMinutes: 0,
          rosterGapMinutes: 0,
        };
        stats.set(s.night, row);
      }
      return row;
    };
    while (s.night <= 6 && s.phase !== 'end') {
      if (++guard > 20000)
        throw new Error(`Safety bound: ${edition}/${seed}/${s.phase}/${s.night}/${s.minute}`);
      const row = stat();
      if (s.phase === 'board') {
        queueInput(s, { kind: 'board', rows: boardDefaults(s) });
        row.boardProposals++;
        queueInput(s, { kind: 'open' });
        continue;
      }
      if (s.phase === 'evening') {
        if (s.night === 3) queueInput(s, { kind: 'jar', choice: 'talk' });
        queueInput(s, { kind: 'open' });
        continue;
      }
      if (s.phase !== 'service') break;
      if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
      const reserved = new Set<string>();
      for (const decision of s.staffing ?? []) {
        if (decision.state !== 'asking') continue;
        const decisionKey = `${s.night}:${decision.id}`;
        const options = staffingOptions(s, decision).filter((id) => !reserved.has(id));
        const willing = options[0];
        const cover = handledStaff.has(decisionKey) ? null : (willing ?? null);
        queueInput(s, { kind: 'staff', id: decision.id, cover });
        if (!handledStaff.has(decisionKey)) row.staffingDecisions++;
        handledStaff.add(decisionKey);
        if (cover) reserved.add(cover);
      }
      const demand = { ...owed(s), dish: s.plates.pile };
      const covered = new Set(
        onShift(s)
          .map((id) => stationOf(s, id))
          .filter(Boolean),
      );
      for (const station of stationsTonight(s)) {
        if (covered.has(station)) continue;
        row.rosterGapMinutes++;
        if (demand[station] > 0) row.uncoveredDemandMinutes++;
      }
      if (s.minute % 5 === 0) {
        for (const station of stationsTonight(s)) {
          if (demand[station] <= 0 || covered.has(station)) continue;
          const cook = onShift(s).find((id) => {
            if (reserved.has(id) || cookOf(s, id).pending || stationOf(s, id)) return false;
            const activity = personOf(s, id).activity;
            if (activity && activity.affordanceId !== 'wait') return false;
            if (s.minute - (lastAsk.get(`${id}:${station}`) ?? -Infinity) < 20) return false;
            const hint = hints(s, id).find((h) => h.verb === station);
            return hint && hint.verdict !== 'refused';
          });
          if (cook) {
            queueInput(s, { kind: 'ask', cook, verb: station });
            row.manualAsks++;
            lastAsk.set(`${cook}:${station}`, s.minute);
            reserved.add(cook);
            covered.add(station);
          }
        }
      }
      step(s);
    }
    for (const report of s.reports.filter((r) => r.night <= 6)) {
      const row = {
        edition,
        seed,
        night: report.night,
        ...stats.get(report.night),
        fed: report.served,
        total: report.served + report.walked,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
}
for (const edition of ['pass@4', 'pass@5']) {
  const selected = rows.filter((r) => r.edition === edition);
  const sum = (
    key:
      | 'manualAsks'
      | 'boardProposals'
      | 'staffingDecisions'
      | 'uncoveredDemandMinutes'
      | 'rosterGapMinutes'
      | 'fed'
      | 'total',
  ) => selected.reduce((n, r) => n + (r[key] ?? 0), 0);
  console.log(
    JSON.stringify({
      edition,
      nights: selected.length,
      averages: Object.fromEntries(
        [
          'manualAsks',
          'boardProposals',
          'staffingDecisions',
          'uncoveredDemandMinutes',
          'rosterGapMinutes',
          'fed',
          'total',
        ].map((key) => [key, sum(key as Parameters<typeof sum>[0]) / selected.length]),
      ),
      fed: sum('fed'),
      total: sum('total'),
    }),
  );
}
