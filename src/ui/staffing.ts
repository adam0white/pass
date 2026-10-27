import { cookOf, type GameState, type StaffingDecision, staffingOptions, stationOf } from '../sim/kitchen.ts';

/** A chef-approved station change already explains the resulting board gap. */
export function actionableStaffing(s: GameState): StaffingDecision[] {
  return (s.staffing ?? []).filter((decision) => {
    if (decision.state !== 'asking') return false;
    if (decision.reason !== 'I’m not at my agreed station, Chef.') return true;
    const cook = cookOf(s, decision.who);
    const cover = cook.cover;
    if (
      cook.gone ||
      !cook.here ||
      !cover ||
      cover.until <= s.minute ||
      cover.station === decision.station ||
      stationOf(s, cook.id) !== cover.station
    )
      return true;
    const answer = cook.night.events.findLast((event) => event.verb === cover.station);
    const acceptedRelief = s.staffing?.some(
      (d) =>
        d.state === 'covered' &&
        d.cover === cook.id &&
        d.station === cover.station &&
        d.until === cover.until,
    );
    return !acceptedRelief && (!answer || !['assented', 'complied', 'countered'].includes(answer.verdict));
  });
}

/** Playback scope: keep an unfillable gap visible without holding the clock at decision speed. */
export function availableStaffing(s: GameState): StaffingDecision[] {
  return actionableStaffing(s).filter(
    (decision) => !['pass@16', 'pass@17'].includes(s.version) || staffingOptions(s, decision).length > 0,
  );
}

export function canCoverStation(s: GameState, station: StaffingDecision['station']): boolean {
  return (
    staffingOptions(s, { id: -1, who: '', station, until: s.minute + 20, reason: '', state: 'asking' })
      .length > 0
  );
}
