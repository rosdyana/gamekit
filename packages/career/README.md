# @taipeistudio/gamekit-career

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-career.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-career) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

The money and public-life side of an athlete career game, as plain data and pure functions.
Anything random takes a `rand: () => number` (pass a seeded one, e.g. from
`@taipeistudio/gamekit-rng`); it uses the same noise as gamekit-rng, draw for draw.
Actions return an error message (string) when refused and never draw random numbers then.

## Installation

```bash
npm install @taipeistudio/gamekit-career
```

## API

- **Money**: `roundMoney` (price-like rounding), `shortMoney` ($12.5K, $3.2M), `spend(wallet,
  amount)`, `convert(amount, from, to, perDollar)`, `progressiveTax(income, brackets)`,
  `splitTax(income, places)` (per-state "jock tax").
- **Portfolio**: `blankPortfolio`, `deposit`/`withdraw` (savings, index, crypto),
  `buyProperty`/`sellProperty`, `openBusiness(wallet, p, kind, cost, make)`/`sellBusiness`,
  `netWorth(cash, p, extra)`, `recordWorth`, and `marketWeek(p, rand, { businesses, fame,
  scale, priceOf, rates })`, which returns the week's income and events (crypto crash or moon,
  business slump, bust or boom). `DEFAULT_RATES` holds the yearly rates.
- **Sponsors**: `sponsorKind(rand, fame, image)` (local → clean or edgy by image),
  `sponsorPay`, `imageWindow`, `acceptSponsor` (per-kind cap), `declineSponsor`,
  `sponsorExitFee`/`cancelSponsor` (buy-outs), `sponsorUpkeep` (expiry and image clauses),
  `sponsorIncome`, `sponsorBonus`.
- **Social**: `followersFor(fame)`, `socialWeek(p)` (followers drift to target, fame fades,
  notoriety bonus), `viral(p, rand, size)`, `followerLabel`.
- **Lifestyle and tiers**: `lifestyleBlocked` (weeks of cost in the bank), `buyTier` (houses,
  cars), `tierOf`/`tierProgress` (bronze/silver/gold style thresholds).

```ts
import { asFn } from "@taipeistudio/gamekit-rng";
import { blankPortfolio, deposit, marketWeek, socialWeek } from "@taipeistudio/gamekit-career";

const s = { rngState: 42, money: 50_000, fame: 30, image: 10, followers: 2_000, invest: blankPortfolio() };
deposit(s, s.invest, "index", 20_000);
const { income, events } = marketWeek(s.invest, asFn(s), { businesses: {}, fame: s.fame });
s.money += income;
socialWeek(s);
```

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
