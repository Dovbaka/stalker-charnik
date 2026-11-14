// Resting: one action that applies everything the rules say about time passing.
// Rules document: Медицина і лікування, Їжа, Вода, Сон, Радіація, Горілка, Удача.
import { clamp, num } from "../util";
import { dawnLuck, maxHp, setHp, useCharge } from "./character";
import { FOOD, WATER } from "./data";
import type { Character } from "./types";

/** How the hours were spent: rest with care, ordinary rest, or under stress and danger. */
export type RestCare = "care" | "normal" | "danger";
/** Where the day's food or water comes from: the backpack, somewhere else, or nowhere. */
export type Supply = "pack" | "other" | "none";

export interface RestOpts {
  hours: number;
  care: RestCare;
  /** no radiation where they rest */
  clean: boolean;
  /** the rest runs through dawn (6:00): a new day starts */
  dawn: boolean;
  /** more than 12 hours in a row in a safe zone that day */
  safe12: boolean;
  food: Supply;
  water: Supply;
}
export const REST0: RestOpts = { hours: 8, care: "normal", clean: true, dawn: true, safe12: false, food: "pack", water: "pack" };

/** Hours per point of health: with care 1, ordinary 2, in danger 4. */
export const HOURS_PER_HP: Record<RestCare, number> = { care: 1, normal: 2, danger: 4 };

export interface RestResult {
  hp: [number, number];
  rad: [number, number];
  luck: [number, number];
  vodka: [number, number];
  /** a full night's sleep cleared the lack of sleep */
  slept: boolean;
  /** what was taken from the backpack */
  eaten: string[];
  drunk: string[];
  /** a new day began without food or water */
  hungry: boolean;
  thirsty: boolean;
  warnings: string[];
}

/** Takes one full ration from the backpack: a whole meal first, else two halves. Returns what was eaten, or null. */
function eatFromPack(c: Character): string[] | null {
  const full = c.items.find(i => FOOD[i.name] === 1 && num(i.qty) > 0);
  if (full) {
    if (full.uses != null) useCharge(full); else full.qty = num(full.qty) - 1;
    return [full.name];
  }
  const halves = c.items.filter(i => FOOD[i.name] === 0.5 && num(i.qty) > 0);
  if (halves.reduce((s, i) => s + num(i.qty), 0) < 2) return null;
  const out: string[] = [];
  for (const i of halves) while (out.length < 2 && num(i.qty) > 0) { i.qty = num(i.qty) - 1; out.push(i.name); }
  return out;
}

/** Applies a rest to the sheet and says what changed. Call it on a copy to preview. */
export function applyRest(c: Character, o: RestOpts): RestResult {
  const hours = clamp(Math.round(num(o.hours, 1)), 1, 24);
  const before = { hp: c.hp, rad: c.rad, luck: num(c.luck.cur), vodka: c.vodka };
  const warnings: string[] = [];
  let eaten: string[] = [], drunk: string[] = [], ate = true, drank = true;

  if (o.dawn) {
    if (o.food === "pack") {
      const got = eatFromPack(c);
      if (got) eaten = got; else { ate = false; warnings.push("У рюкзаку немає повного раціону."); }
    } else if (o.food === "none") ate = false;
    if (o.water === "pack") {
      const w = c.items.find(i => i.name === WATER && num(i.qty) > 0);
      if (w) { w.qty = num(w.qty) - 1; drunk = [WATER]; } else { drank = false; warnings.push("У рюкзаку немає води."); }
    } else if (o.water === "none") drank = false;
    c.noFood = ate ? 0 : num(c.noFood) + 1;
    c.noWater = drank ? 0 : num(c.noWater) + 1;
    if (!ate) warnings.push("День без їжі: −1 Тілобудова.");
    if (!drank) warnings.push("День без води: −1 Тілобудова.");
    dawnLuck(c, o.safe12);
  }

  // without access to food and water health does not come back
  const fed = !o.dawn || (ate && drank);
  if (fed) setHp(c, Math.min(maxHp(c), c.hp + Math.floor(hours / HOURS_PER_HP[o.care])));
  else warnings.push("Без їжі й води здоров'я не відновлюється.");

  if (o.clean) c.rad = Math.max(0, c.rad - 2 * hours); // 1 rad every half hour
  c.vodka = Math.max(0, num(c.vodka) - hours); // one point back every hour
  const slept = hours >= 6;
  if (slept) c.noSleep = 0;

  return { hp: [before.hp, c.hp], rad: [before.rad, c.rad], luck: [before.luck, num(c.luck.cur)], vodka: [before.vodka, c.vodka], slept, eaten, drunk, hungry: !ate, thirsty: !drank, warnings };
}

/** What a rest would do, without touching the sheet. */
export const planRest = (c: Character, o: RestOpts): RestResult => applyRest(structuredClone(c), o);
