// Endorsements: who approaches you (by fame and image), what they pay, image clauses,
// buy-outs and expiry. Brand names and markets stay in the game.
import { roundMoney, type Rand, type Wallet } from "./money.js";

/** local: hometown businesses; clean: mainstream brands; edgy: brands that like a bad boy. */
export type SponsorKind = "local" | "clean" | "edgy";

export interface Sponsor<K extends string = SponsorKind> {
  id: string;
  brand: string;
  kind: K;
  /** Market (e.g. nation code) the brand comes from. */
  country?: string;
  weekly: number;
  /** Paid per match feat (goal, clean sheet, double-double...). */
  bonus: number;
  /** Absolute week the deal ends. */
  until: number;
  /** The sponsor walks if image drops below minImage (clean) or rises above maxImage (edgy). */
  minImage: number;
  maxImage: number;
  /** Offers only: the week the offer lapses. */
  expires?: number;
}

export interface SponsorBook<K extends string = SponsorKind> {
  sponsors: Sponsor<K>[];
  sponsorOffers: Sponsor<K>[];
}

/**
 * The kind of brand that approaches: local until `localBelow` fame, then clean or edgy by
 * image (image -100..100). Draws one number only once past the local stage.
 */
export function sponsorKind(r: Rand, fame: number, image: number, localBelow = 15): SponsorKind {
  if (fame < localBelow) return "local";
  const edgy = image < -20 ? 0.7 : image < 10 ? 0.25 : 0.05;
  return r() < edgy ? "edgy" : "clean";
}

/** Weekly fee by fame (0..100); `scale` shrinks it for smaller markets. Rounded to tens. */
export function sponsorPay(kind: SponsorKind, fame: number, scale = 1): number {
  const big = 30 + Math.pow(fame, 2.1) * 3 * scale;
  return Math.round((kind === "local" ? 20 + fame * 4 : big * (kind === "edgy" ? 1.3 : 1)) / 10) * 10;
}

/** Image window for a kind: clean brands leave below -10, edgy ones above 60. */
export const imageWindow = (kind: SponsorKind): [number, number] => [kind === "clean" ? -10 : -100, kind === "edgy" ? 60 : 100];

export const sponsorIncome = (list: readonly Sponsor<string>[]) => list.reduce((a, sp) => a + sp.weekly, 0);

/** Bonus money for `units` feats in one match. */
export const sponsorBonus = (list: readonly Sponsor<string>[], units: number) =>
  units > 0 ? list.reduce((a, sp) => a + sp.bonus * units, 0) : 0;

/**
 * Accept an offer. At most `maxPerKind` deals of a kind at once, except the `unlimited` kinds.
 * Returns the signed deal, or an error message.
 */
export function acceptSponsor<K extends string>(
  book: SponsorBook<K>,
  id: string,
  maxPerKind = 3,
  unlimited: readonly string[] = ["local"],
): Sponsor<K> | string {
  const o = book.sponsorOffers.find((x) => x.id === id);
  if (!o) return "Offer expired";
  if (!unlimited.includes(o.kind) && book.sponsors.filter((x) => x.kind === o.kind).length >= maxPerKind)
    return `Your agent says ${maxPerKind} big brands at once is the limit.`;
  book.sponsorOffers = book.sponsorOffers.filter((x) => x.id !== id);
  delete o.expires;
  book.sponsors.push(o);
  return o;
}

export function declineSponsor<K extends string>(book: SponsorBook<K>, id: string) {
  book.sponsorOffers = book.sponsorOffers.filter((x) => x.id !== id);
}

/** Buying out a deal: up to `weeks` of the remaining fees plus a `penalty` of weeks on top. */
export function sponsorExitFee(sp: Sponsor<string>, week: number, weeks = 26, penalty = 2): number {
  const left = Math.max(0, sp.until - week);
  return roundMoney(sp.weekly * Math.min(weeks, left) + sp.weekly * penalty);
}

export function cancelSponsor<K extends string>(w: Wallet, book: SponsorBook<K>, id: string, week: number): Sponsor<K> | string {
  const sp = book.sponsors.find((x) => x.id === id);
  if (!sp) return "No such deal.";
  const fee = sponsorExitFee(sp, week);
  if (w.money < fee) return `You need $${fee.toLocaleString("en-US")} to buy out the contract.`;
  w.money -= fee;
  book.sponsors = book.sponsors.filter((x) => x !== sp);
  return sp;
}

/** Weekly upkeep: drop lapsed offers, end finished deals, enforce image clauses (in list order). */
export function sponsorUpkeep<K extends string>(
  book: SponsorBook<K>,
  week: number,
  image: number,
): { sponsor: Sponsor<K>; why: "ended" | "image" }[] {
  const out: { sponsor: Sponsor<K>; why: "ended" | "image" }[] = [];
  book.sponsorOffers = book.sponsorOffers.filter((o) => (o.expires ?? 0) > week);
  for (const sp of [...book.sponsors]) {
    if (sp.until <= week) {
      book.sponsors = book.sponsors.filter((x) => x !== sp);
      out.push({ sponsor: sp, why: "ended" });
    } else if (image < sp.minImage || image > sp.maxImage) {
      book.sponsors = book.sponsors.filter((x) => x !== sp);
      out.push({ sponsor: sp, why: "image" });
    }
  }
  return out;
}
