import { roundRobin, standings, table, type Fixture, type PointsRule, type Row, type Table, type Tiebreak } from "./league.js";
import { shuffle, type Rand } from "./util.js";

/**
 * Draw pots into groups (World Cup / Champions League style): each pot puts
 * one team in every group. `conflict(a, b)` forbids two teams sharing a group
 * (e.g. same country); the draw backtracks until it satisfies every rule.
 */
export function drawGroups<T>(
  pots: readonly (readonly T[])[],
  groupCount: number,
  rand: Rand,
  conflict: (a: T, b: T) => boolean = () => false,
): T[][] {
  for (const pot of pots) {
    if (pot.length > groupCount) throw new Error("A pot has more teams than there are groups");
  }
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  const order = pots.flatMap((pot, p) => shuffle(rand, pot).map((team) => ({ team, p })));
  let steps = 0;
  const place = (i: number): boolean => {
    if (i === order.length) return true;
    if (++steps > 200_000) return false;
    const { team, p } = order[i];
    const slots = shuffle(
      rand,
      groups.map((_, g) => g),
    );
    for (const g of slots) {
      const group = groups[g];
      // One team per pot per group, and no conflicts.
      if (group.length !== p) continue;
      if (group.some((x) => conflict(x, team))) continue;
      group.push(team);
      if (place(i + 1)) return true;
      group.pop();
    }
    return false;
  };
  if (!place(0)) throw new Error("No valid group draw satisfies the constraints");
  return groups;
}

export interface GroupStage<T> {
  groups: Table<T>[];
  /** Per group: matchdays of fixtures. */
  fixtures: Fixture<T>[][][];
}

export function groupStage<T>(groups: T[][], o: { double?: boolean; rule?: PointsRule } = {}): GroupStage<T> {
  return {
    groups: groups.map((g) => table(g, o.rule)),
    fixtures: groups.map((g) => roundRobin(g, { double: o.double })),
  };
}

/** Top `n` of each group, as [group][position] rows. */
export function qualifiers<T>(stage: GroupStage<T>, n: number, tiebreaks?: Tiebreak[]): Row<T>[][] {
  return stage.groups.map((t) => standings(t, tiebreaks).slice(0, n));
}

/**
 * Classic cross-over pairing for the knockout draw: A1 v B2, B1 v A2, C1 v D2…
 * Returns bracket slots ready for `knockout()`.
 */
export function crossOver<T>(winners: T[], runnersUp: T[]): T[] {
  const slots: T[] = [];
  for (let g = 0; g < winners.length; g += 2) {
    slots.push(winners[g], runnersUp[g + 1], winners[g + 1], runnersUp[g]);
  }
  return slots;
}
