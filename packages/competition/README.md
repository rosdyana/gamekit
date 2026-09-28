# @taipeistudio/gamekit-competition

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-competition.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-competition) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Sports competition engine as plain, save-friendly data.

## Installation

```bash
npm install @taipeistudio/gamekit-competition
```

## API

- **Knockouts**: `seedOrder`, `seedBracket` (byes to top seeds), `knockout`, `pairs`,
  `playRound(ko, decide, override)` (override = the human's match), `playOut`, `champion`,
  `exitRound`, `reached` (W/F/SF/QF/R16…), `roundLabel`, `roundCodes`.
- **Leagues**: `roundRobin(teams, { double, rand })` (circle method, balanced home/away,
  rest days for odd counts), `table`, `record`, `standings(t, tiebreaks)` with points,
  goal difference, goals for, wins and head-to-head mini-leagues; `FOOTBALL_POINTS`.
- **Groups**: `drawGroups(pots, n, rand, conflict)` (backtracking, e.g. no same country),
  `groupStage`, `qualifiers`, `crossOver` (A1 v B2…).
- **League phase (Swiss)**: `swissDraw(pots, rand, { perPot, conflict, attempts })` — the
  2024+ Champions League draw: `perPot` opponents from every pot (own included), half at
  home, no repeats or conflicts, laid out as `perPot * pots.length` matchdays where everyone
  plays once. Pots must be equal size; throws if no draw is found. Rank it with `table()`.
- **Pyramids**: `promoteRelegate(tiers, moves)` (a count per boundary, sizes preserved; new
  tier = survivors, then promoted-in, then relegated-in), `allocate(order, slots)` (split a
  final table into `{ cl, el, down… }`).
- **Results**: `expected`/`eloUpdate`/`eloWinner`, `poisson`, `scoreline` (football-like
  scores from two ratings, home edge), `twoLegs` (aggregate, then your decider),
  `penalties`.
- **Rankings**: `rank(entries, now, { window, best, include })` (rolling best-N, e.g.
  52 weeks / best 10), `prune`, `memoRanking`, `TOUR_SHARES` (points/prize by round).

See the [football career example](https://github.com/rosdyana/gamekit#example-a-football-career) in the gamekit README.

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
