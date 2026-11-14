// Everything the rules compute from a sheet. Pure functions: no React, no Firebase.
// Functions that take a `c` and return nothing mutate it; call them inside an immer recipe.
import { clamp, num, uid } from "../util";
import { ATTR_KEYS, ATTR_PTS, CUSTOM_GUN, GUNS, MARKET, RAD_PEN, SKILL_KEYS, SKILL_NAME, SKILL_PTS, START_MONEY, marketName, type GunEntry, type MarketEntry } from "./data";
import type { AttrKey, Character, Item, SkillKey } from "./types";

/* ---------- shape ---------- */
const zeroAttrs = (v: number) => Object.fromEntries(ATTR_KEYS.map(k => [k, v])) as Record<AttrKey, number>;
const zeroSkills = () => Object.fromEntries(SKILL_KEYS.map(k => [k, 0])) as Record<SkillKey, number>;

export function blankCharacter(): Character {
  return {
    v: 2, cid: "",
    id: { callsign: "", name: "", role: "", age: "", looks: "", about: "" },
    attrs: zeroAttrs(1), attrMod: zeroAttrs(0), skills: zeroSkills(),
    zone: 0, freeSkill: 0, freeAttr: 0,
    hp: 15, woundsTreated: false, bleed: 0, rad: 0, vodka: 0, noSleep: 0, noFood: 0, noWater: 0, conditions: "",
    money: START_MONEY,
    armor: { name: "Шкіряна куртка", kin: 2, acid: 2, fire: 2, elec: 2, rad: 0, w: 3, countW: false, slots: 1, mask: false },
    weapons: [], items: [], artifacts: [], abilities: [],
    reroll: { skill: "", bonus: 2 },
    notes: "", createdAt: 0, updatedAt: 0,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Brings any stored or imported sheet to the current shape. Unknown input yields a blank sheet. */
export function migrate(raw: unknown): Character {
  const s = blankCharacter() as unknown as Record<string, unknown>;
  if (isObj(raw)) {
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (isObj(v) && isObj(s[k])) Object.assign(s[k] as object, v);
      else if (v !== undefined) s[k] = v;
    }
  }
  for (const k of ["weapons", "items", "artifacts", "abilities"]) {
    const list = Array.isArray(s[k]) ? (s[k] as unknown[]).filter(isObj).map(x => ({ ...x })) : [];
    for (const x of list) if (!x.id) x.id = uid();
    s[k] = list;
  }
  delete s.by;
  delete s.secret; // private notes live in their own document
  s.v = 2;
  return s as unknown as Character;
}

/* ---------- budgets ---------- */
export const maxHp = (c: Character) => num(c.attrs.til) * 5 + 10;
/** a level costs its own number, so level L costs 1 + 2 + … + L in total */
export const skillCost = (level: number) => (level * (level + 1)) / 2;
export const skillSpent = (c: Character) => SKILL_KEYS.reduce((s, k) => s + skillCost(num(c.skills[k])), 0);
export const attrSpent = (c: Character) => ATTR_KEYS.reduce((s, k) => s + num(c.attrs[k]), 0);

/* ---------- health ---------- */
function woundsAt(c: Character, hp: number): number {
  const max = maxHp(c), lost = max - hp;
  return hp <= 0 ? 4 : lost >= max * 0.75 ? 3 : lost >= max * 0.5 ? 2 : lost >= max * 0.25 ? 1 : 0;
}
/** Sets health; a new wound cancels the "wounds treated" relief, as the rules say. */
export function setHp(c: Character, v: number): void {
  const max = maxHp(c), before = woundsAt(c, c.hp);
  c.hp = clamp(Math.round(v), -max, max);
  if (woundsAt(c, c.hp) > before) c.woundsTreated = false;
}
export type DamageType = "kin" | "none" | "acid" | "fire" | "elec";
/** Applies incoming damage through armour; returns what actually got through and what the armour took. */
export function takeDamage(c: Character, amount: number, type: DamageType): { real: number; absorbed: number } {
  const arm = type === "none" ? 0 : num(c.armor[type]);
  const real = Math.max(0, amount - arm);
  setHp(c, c.hp - real);
  return { real, absorbed: Math.min(arm, amount) };
}

export function totalWeight(c: Character): number {
  let w = 0;
  for (const it of c.items) w += num(it.qty) * num(it.w);
  for (const g of c.weapons) w += num(g.w);
  if (c.armor.countW) w += num(c.armor.w);
  return w;
}

/* ---------- derived state ---------- */
export interface Derived {
  max: number;
  /** wounds by lost health: 0..3 */
  wounds: number;
  state: "ok" | "out" | "dead";
  label: string;
  hpCls: "ok" | "warn" | "bad";
  /** penalty to every check from untreated wounds */
  checkPen: number;
  /** attributes after every modifier */
  eff: Record<AttrKey, number>;
  /** where each attribute's modifiers come from */
  lines: Record<AttrKey, [string, number][]>;
  halves: Record<AttrKey, string[]>;
  radStage: number;
  weight: number;
  cap: number;
  /** 0 fine, 1 overloaded (Спритність halved), 2 beyond the limit */
  over: 0 | 1 | 2;
  woundText: string;
  vodkaOut: boolean;
  nextVodkaOut: boolean;
}

const VODKA_ATTRS: AttrKey[] = ["mud", "rea", "spy", "spr"];
const WOUND_TEXT = ["", "1 поранення: −1 до всіх перевірок.", "2 поранення: −1 до всіх характеристик, −2 до всіх перевірок.", "3 поранення: характеристики вдвічі менші, −2 до всіх перевірок."];

export function derive(c: Character): Derived {
  const max = maxHp(c), hp = c.hp, lost = max - hp;
  let wounds = 0, state: Derived["state"] = "ok";
  if (hp <= -max / 4) state = "dead";
  else if (hp <= 0) state = "out";
  else if (lost >= max * 0.75) wounds = 3;
  else if (lost >= max * 0.5) wounds = 2;
  else if (lost >= max * 0.25) wounds = 1;
  const wEff = c.woundsTreated ? 0 : wounds;
  const checkPen = wEff === 1 ? -1 : wEff >= 2 ? -2 : 0;

  const lines = Object.fromEntries(ATTR_KEYS.map(k => [k, []])) as unknown as Derived["lines"];
  const halves = Object.fromEntries(ATTR_KEYS.map(k => [k, []])) as unknown as Derived["halves"];
  const add = (k: AttrKey, v: number, src: string) => { if (v) lines[k].push([src, v]); };

  if (wEff === 2) for (const k of ATTR_KEYS) add(k, -1, "рани");
  if (wEff === 3) for (const k of ATTR_KEYS) halves[k].push("рани");
  const r = c.rad, radStage = r >= 1000 ? 5 : r >= 800 ? 4 : r >= 500 ? 3 : r >= 300 ? 2 : r >= 100 ? 1 : 0;
  add("til", -RAD_PEN[radStage][0], "радіація"); add("spr", -RAD_PEN[radStage][1], "радіація"); add("rea", -RAD_PEN[radStage][2], "радіація");
  if (c.vodka > 0) for (const k of VODKA_ATTRS) add(k, -c.vodka, "горілка");
  if (c.noSleep === 1) for (const k of ATTR_KEYS) { if (k !== "til") add(k, -1, "без сну"); }
  if (c.noSleep >= 2) for (const k of ATTR_KEYS) add(k, k === "til" ? -1 : -2, "без сну");
  add("til", -c.noFood, "голод"); add("til", -c.noWater, "спрага");
  for (const k of ATTR_KEYS) add(k, num(c.attrMod[k]), "інше");

  const calc = (k: AttrKey) => {
    let v = num(c.attrs[k]) + lines[k].reduce((s, x) => s + x[1], 0);
    for (let i = 0; i < halves[k].length; i++) v = Math.ceil(v / 2);
    return Math.max(0, v);
  };
  const eff = { til: calc("til") } as Record<AttrKey, number>;
  const weight = totalWeight(c), cap = eff.til * 10;
  const over: Derived["over"] = weight > cap * 1.5 ? 2 : weight > cap ? 1 : 0;
  if (over) halves.spr.push("перевантаження");
  for (const k of ATTR_KEYS) if (k !== "til") eff[k] = calc(k);

  const vodkaOut = c.vodka > 0 && VODKA_ATTRS.some(k => eff[k] <= 0);
  const nextVodkaOut = VODKA_ATTRS.some(k => eff[k] - 1 <= 0);
  if (radStage === 5 || ((c.noFood > 0 || c.noWater > 0) && eff.til <= 0)) state = "dead";
  if (state === "ok" && (vodkaOut || c.noSleep >= 3)) state = "out";

  const label = state === "dead" ? "Смерть" : state === "out" ? "Без свідомості" : wounds === 0 ? "У строю" : wounds === 1 ? "Поранення" : "Поранення ×" + wounds;
  const hpCls: Derived["hpCls"] = state !== "ok" || wounds >= 2 ? "bad" : wounds === 1 ? "warn" : "ok";
  const woundText = wounds && c.woundsTreated ? WOUND_TEXT[wounds] + " Зараз знято лікуванням." : WOUND_TEXT[wounds];
  return { max, wounds, state, label, hpCls, checkPen, eff, lines, halves, radStage, weight, cap, over, woundText, vodkaOut, nextVodkaOut };
}

/* ---------- shooting ---------- */
export interface ShotOpts {
  skill: "rifles" | "pistols" | "heavy";
  shot: "aimed" | "quick";
  sit: boolean; optic: boolean; colim: boolean;
  near: "far" | "10" | "1";
  cover: "0" | "1" | "3";
  tprone: boolean; vis: boolean; invis: boolean; lying: boolean;
  rounds: number; nato: boolean; jam: number; extra: number;
}
export const SHOT0: ShotOpts = { skill: "rifles", shot: "aimed", sit: false, optic: false, colim: false, near: "far", cover: "0", tprone: false, vis: false, invis: false, lying: false, rounds: 0, nato: false, jam: 0, extra: 0 };

export interface ShotCalc {
  parts: [string, number][];
  /** total modifier added to к10 */
  mod: number;
  /** what the die has to show; a hit is к10 + mod >= 9 */
  need: number;
  chance: number;
  /** chance with the backstory reroll, when the character has one for this weapon */
  chanceReroll: number;
  reroll: boolean;
  rerollBonus: number;
}
export function shotCalc(c: Character, d: Derived, o: ShotOpts): ShotCalc {
  const parts: [string, number][] = [[SKILL_NAME[o.skill], num(c.skills[o.skill])]];
  const P = (n: string, v: number) => parts.push([n, v]);
  if (o.shot === "quick") P("швидкий постріл", -1);
  if (o.shot === "aimed" && o.sit) P("сидячи", 1);
  if (o.optic) P("оптика", 1);
  if (o.colim) P("коліматор", 1);
  if (o.near === "10") P("ціль до 10 м", 1);
  if (o.near === "1") P("ціль до 1 м", 3);
  if (o.cover === "1") P("укриття ½", -1);
  if (o.cover === "3") P("укриття ¾", -3);
  if (o.tprone) P("ціль лежить", -1);
  if (c.armor.mask) P("протигаз", -1);
  if (o.vis) P("погана видимість", -2);
  if (o.invis) P("ціль невидима", -3);
  if (o.lying) P("стрільба лежачи", -2);
  if (o.rounds) P("раунди по цілі", o.rounds);
  if (o.nato) P("зброя НАТО", 1);
  if (o.jam) P("заклинювання", -o.jam);
  if (o.extra) P("інше", o.extra);
  if (d.checkPen) P("рани", d.checkPen);
  const mod = parts.reduce((s, x) => s + x[1], 0);
  const rb = num(c.reroll?.bonus), rs = c.reroll?.skill ?? "";
  const reroll = !!rs && rb > 0 && (rs === "any" || rs === o.skill);
  const chance = clamp((mod + 2) / 10, 0, 1);
  const chanceReroll = reroll ? chance + (1 - chance) * clamp((mod + 2 + rb) / 10, 0, 1) : chance;
  return { parts, mod, need: 9 - mod, chance, chanceReroll, reroll, rerollBonus: rb };
}

/* ---------- gear ---------- */
export function addMarketItem(c: Character, m: MarketEntry): void {
  if (m.ammo && m.cal && m.pack) {
    const it = c.items.find(x => x.ammo && x.cal === m.cal);
    if (it) it.qty = num(it.qty) + m.pack;
    else c.items.push({ id: uid(), name: "Набої " + m.cal, qty: m.pack, w: Math.round(10000 / m.pack) / 10000, cal: m.cal, ammo: true, note: "" });
    return;
  }
  const name = m.n ?? "";
  const it = c.items.find(x => x.name === name);
  if (it) { it.qty = num(it.qty) + 1; if (m.uses && !(num(it.uses) > 0)) it.uses = m.uses; return; }
  const o: Item = { id: uid(), name, qty: 1, w: m.w ?? 0, note: m.d ?? "" };
  if (m.uses) { o.uses = m.uses; o.max = m.uses; }
  if (m.fx) o.fx = m.fx;
  c.items.push(o);
}
export function addGun(c: Character, g: GunEntry = CUSTOM_GUN): void {
  c.weapons.push({ id: uid(), name: g.n, skill: g.skill, dmg: g.dmg, mag: g.mag, cur: g.mag, modes: g.modes, w: g.w, cal: g.cal, nato: !!g.nato, jams: 0, note: g.note });
}
/** Spends one use of a kit; an emptied kit takes one off the count and opens the next. */
export function useCharge(it: Item): void {
  it.uses = num(it.uses, 1) - 1;
  if (it.uses <= 0) { it.qty = Math.max(0, num(it.qty) - 1); it.uses = it.qty > 0 ? num(it.max, 3) : 0; }
}
/** Uses a consumable with a built-in effect; returns the line to show, or "" if nothing happened. */
export function useItem(c: Character, id: string): string {
  const it = c.items.find(x => x.id === id);
  if (!it || num(it.qty) <= 0) return "";
  if (it.fx === "antirad") { it.qty--; c.rad = Math.max(0, c.rad - 250); return "Антирад: −250 рад."; }
  if (it.fx === "vodka") { it.qty--; c.rad = Math.max(0, c.rad - 100); c.vodka = Math.min(9, c.vodka + 1); return "Горілка: −100 рад, −1 до Мудрості, Реакції, Сприйняття і Спритності."; }
  if (it.fx === "sci") { c.rad = Math.max(0, c.rad - 250); useCharge(it); return "Наукова аптечка: −250 рад, одне використання."; }
  return "";
}
const normCal = (s: string) => String(s || "").toLowerCase().replace(/[xх*]/g, "×").replace(/мм|\s/g, "");
/** Refills the magazine from matching ammunition in the backpack; returns the line to show. */
export function reload(c: Character, weaponId: string): string {
  const g = c.weapons.find(x => x.id === weaponId);
  if (!g) return "";
  const mag = num(g.mag), need = mag - clamp(num(g.cur), 0, mag);
  if (need <= 0) return "Магазин повний.";
  const it = c.items.find(x => x.ammo && normCal(x.cal ?? "") === normCal(g.cal));
  if (!it) { g.cur = mag; return `Набоїв ${g.cal || "цього калібру"} у рюкзаку немає, запас не списано.`; }
  const take = Math.min(need, num(it.qty));
  if (take <= 0) return "Набої в рюкзаку скінчилися.";
  it.qty = num(it.qty) - take; g.cur = num(g.cur) + take;
  return `Заряджено ${take}, у рюкзаку лишилось ${it.qty}.`;
}

/* ---------- creation wizard ---------- */
export interface Draft {
  step: number;
  d: Character;
  /** how many of each catalogue entry is in the basket, by index */
  cart: { m: Record<string, number>; g: Record<string, number> };
  /** an optional backstory ability typed on the first step */
  ab: { name: string; text: string };
}
export const newDraft = (): Draft => ({ step: 0, d: blankCharacter(), cart: { m: {}, g: {} }, ab: { name: "", text: "" } });

export function cartTotals(w: Draft): { cost: number; weight: number } {
  let cost = 0, weight = 0;
  for (const i of Object.keys(w.cart.m)) { const m = MARKET[Number(i)], q = num(w.cart.m[i]); if (m && q) { cost += m.p * q; weight += (m.ammo ? 1 : m.w ?? 0) * q; } }
  for (const i of Object.keys(w.cart.g)) { const g = GUNS[Number(i)], q = num(w.cart.g[i]); if (g && q) { cost += g.p * q; weight += g.w * q; } }
  return { cost, weight };
}
export const attrLeft = (c: Character) => ATTR_PTS - attrSpent(c);
export const skillLeft = (c: Character) => SKILL_PTS - skillSpent(c);
export const draftGearList = (w: Draft): string[] => [
  ...Object.keys(w.cart.m).filter(i => num(w.cart.m[i]) > 0).map(i => `${marketName(MARKET[Number(i)])} ×${w.cart.m[i]}`),
  ...Object.keys(w.cart.g).filter(i => num(w.cart.g[i]) > 0).map(i => `${GUNS[Number(i)].n} ×${w.cart.g[i]}`),
];

/** Turns a finished draft into a sheet: buys the basket, banks leftover points, fills health. */
export function finishDraft(w: Draft): Character {
  const c = migrate(w.d);
  const t = cartTotals(w);
  for (const i of Object.keys(w.cart.m)) for (let n = 0; n < num(w.cart.m[i]); n++) addMarketItem(c, MARKET[Number(i)]);
  for (const i of Object.keys(w.cart.g)) for (let n = 0; n < num(w.cart.g[i]); n++) addGun(c, GUNS[Number(i)]);
  c.money = c.money - t.cost;
  c.freeAttr = Math.max(0, attrLeft(c));
  c.freeSkill = Math.max(0, skillLeft(c));
  c.hp = maxHp(c);
  if (w.ab.name.trim()) c.abilities.push({ id: uid(), name: w.ab.name.trim(), text: w.ab.text.trim() });
  c.createdAt = c.updatedAt = Date.now();
  return c;
}
