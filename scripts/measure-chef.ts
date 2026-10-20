// Matched plain rota policy, with or without optional chef food and pass calls.
// Both accept default boards, requests and willing emergency cover; neither insists.
import {
  boardDefaults,
  cookOf,
  helpOptions,
  hints,
  newGame,
  onShift,
  owed,
  personOf,
  priorityOptions,
  queueInput,
  staffingOptions,
  stationOf,
  stationsTonight,
  step,
} from '../src/sim/kitchen.ts';

for (const policy of ['hands-off', 'always-help', 'chef-and-pass']) {
  for (const seed of [7, 21, 42]) {
    const s = newGame(seed);
    const stats = new Map<
      number,
      {
        chefActions: number;
        chefCompletions: number;
        chefCancellations: number;
        passDecisions: number;
        asks: number;
        staffing: number;
        chefPeakExertion: number;
      }
    >();
    const lastAsk = new Map<string, number>();
    let guard = 0;
    while (s.night <= 6 && s.phase !== 'end') {
      if (++guard > 20000) throw new Error(`Safety bound ${seed}/${policy}`);
      let row = stats.get(s.night);
      if (!row) {
        row = {
          chefActions: 0,
          chefCompletions: 0,
          chefCancellations: 0,
          passDecisions: 0,
          asks: 0,
          staffing: 0,
          chefPeakExertion: 0,
        };
        stats.set(s.night, row);
      }
      if (s.phase === 'board') {
        queueInput(s, { kind: 'board', rows: boardDefaults(s) });
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
      for (const d of s.staffing ?? []) {
        if (d.state !== 'asking') continue;
        const cover = staffingOptions(s, d).find((id) => !reserved.has(id)) ?? null;
        queueInput(s, { kind: 'staff', id: d.id, cover });
        row.staffing++;
        if (cover) reserved.add(cover);
      }
      // The unchanged plain policy: only ask an idle cook for uncovered waiting work.
      if (s.minute % 5 === 0) {
        const demand = { ...owed(s), dish: s.plates.pile };
        const covered = new Set(onShift(s).map((id) => stationOf(s, id)));
        for (const station of stationsTonight(s)) {
          if (demand[station] <= 0 || covered.has(station)) continue;
          const cook = onShift(s).find((id) => {
            if (reserved.has(id) || cookOf(s, id).pending || stationOf(s, id)) return false;
            const a = personOf(s, id).activity;
            if (a && a.affordanceId !== 'wait') return false;
            if (s.minute - (lastAsk.get(`${id}:${station}`) ?? -Infinity) < 20) return false;
            const hint = hints(s, id).find((h) => h.verb === station);
            return hint && hint.verdict !== 'refused';
          });
          if (!cook) continue;
          queueInput(s, { kind: 'ask', cook, verb: station });
          row.asks++;
          lastAsk.set(`${cook}:${station}`, s.minute);
          reserved.add(cook);
          covered.add(station);
        }
      }
      if (policy !== 'hands-off') {
        const choices = priorityOptions(s);
        const priority = choices.at(-1);
        if (priority) {
          queueInput(s, { kind: 'pass-priority', ticket: priority.ticket });
          row.passDecisions++;
        }
        const option = policy === 'always-help' || s.passDecision ? helpOptions(s)[0] : undefined;
        if (option) {
          queueInput(s, { kind: 'help', ticket: option.ticket, station: option.station });
          row.chefActions++;
        }
      }
      const before = s.help;
      const at = s.minute;
      step(s);
      if (before && !s.help) {
        if (s.said.some((line) => line.at === at && line.text.startsWith('I finished')))
          row.chefCompletions++;
        else row.chefCancellations++;
      }
      row.chefPeakExertion = Math.max(row.chefPeakExertion, s.chef.body.exertion);
    }
    for (const report of s.reports.filter((r) => r.night <= 6)) {
      console.log(
        JSON.stringify({
          edition: s.version,
          policy,
          seed,
          night: report.night,
          ...stats.get(report.night),
          fed: report.served,
          total: report.served + report.walked,
        }),
      );
    }
  }
}
