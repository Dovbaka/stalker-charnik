// Everything the rules compute from a sheet. Pure functions: no React, no Firebase.
// Functions that take a `c` and return nothing mutate it; call them inside an immer recipe.
import { clamp, num, uid } from "../util";
import { DEFAULT_CATALOG, type CatArmor, type Catalog } from "./catalog";
import { ATTR_KEYS, ATTR_PTS, CUSTOM_GUN, RAD_PEN, SKILL_KEYS, SKILL_NAME, SKILL_PTS, START_MONEY, marketName, modPreset, type GunEntry, type MarketEntry, type ModPreset } from "./data";
import type { Armor, AttrKey, Character, Item, SkillKey, Weapon } from "./types";

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
    armors: [startingJacket()],
    mask: false,
    weapons: [], items: [], artifacts: [], abilities: [],
    reroll: { skill: "", bonus: 2 },
    luck: { pool: 0, cur: 0 },
    notes: "", createdAt: 0, updatedAt: 0,
  };
}

/** Everyone enters the Zone in a leather jacket; the rules keep it out of the load. */
export function startingJacket(): Armor {
  return { id: uid(), name: "Шкіряна куртка", kin: 2, acid: 2, fire: 2, elec: 2, rad: 0, w: 3, countW: false, slots: 1, on: true };
}
export function newArmor(): Armor {
  return { id: uid(), name: "Нова броня", kin: 0, acid: 0, fire: 0, elec: 0, rad: 0, w: 0, countW: true, slots: 0, on: false };
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
  // sheets saved before several armours existed kept one `armor` (with the gas mask on it)
  if (isObj(raw) && isObj(raw.armor) && !Array.isArray(raw.armors)) {
    const { mask, ...old } = raw.armor;
    s.armors = [{ ...startingJacket(), ...old, on: true }];
    if (raw.mask === undefined) s.mask = !!mask;
  }
  delete s.armor;
  for (const k of ["weapons", "items", "artifacts", "abilities", "armors"]) {
    const list = Array.isArray(s[k]) ? (s[k] as unknown[]).filter(isObj).map(x => ({ ...x })) : [];
    for (const x of list) if (!x.id) x.id = uid();
    s[k] = list;
  }
  for (const g of s.weapons as Record<string, unknown>[]) {
    if (typeof g.on !== "boolean") g.on = true;
    if (typeof g.range !== "string") g.range = "";
    g.mods = Array.isArray(g.mods) ? (g.mods as unknown[]).filter(isObj).map(m => ({ id: m.id || uid(), name: String(m.name ?? ""), kind: m.kind ?? "other", bonus: num(m.bonus) })) : [];
  }
  const armors = s.armors as Record<string, unknown>[];
  armors.forEach((a, i) => { a.on = !!a.on && armors.findIndex(x => x.on) === i; });
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
/** The armour being worn, or none. */
export const worn = (c: Character): Armor | undefined => c.armors.find(a => a.on);
/** Puts one armour on and takes any other off. */
export function wear(c: Character, id: string): void {
  for (const a of c.armors) a.on = a.id === id ? !a.on : false;
}
export function takeDamage(c: Character, amount: number, type: DamageType): { real: number; absorbed: number } {
  const a = worn(c);
  const arm = type === "none" || !a ? 0 : num(a[type]);
  const real = Math.max(0, amount - arm);
  setHp(c, c.hp - real);
  return { real, absorbed: Math.min(arm, amount) };
}

/** What the load is made of: the backpack, the weapons, and the armour when it is counted. */
export function weightParts(c: Character): { items: number; weapons: number; armor: number } {
  let items = 0, weapons = 0;
  for (const it of c.items) items += num(it.qty) * num(it.w);
  for (const g of c.weapons) weapons += num(g.w);
  const armor = c.armors.reduce((sum, a) => sum + (a.countW ? num(a.w) : 0), 0);
  return { items, weapons, armor };
}
export function totalWeight(c: Character): number {
  const p = weightParts(c);
  return p.items + p.weapons + p.armor;
}

/* ---------- derived state ---------- */
export interface Derived {
  max: number;
  /** wounds by lost health: 0..3 */
  wounds: number;
  state: "ok" | "out" | "dead";
  label: string;
  /** colour step of the health bar: the number of wounds, 4 when unconscious or dead */
  level: 0 | 1 | 2 | 3 | 4;
  /** health values at which the first, second and third wound begin */
  marks: [number, number, number];
  /** health at which the character dies */
  deathAt: number;
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
  if (c.vodka > 0) for (const k of VODKA_ATTRS) add(k, -c.vodka, "алкоголь");
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
  const level = (state !== "ok" ? 4 : wounds) as Derived["level"];
  // a wound starts once a quarter of health is lost: with 25 health that is at 18, 12 and 6
  const marks = [1, 2, 3].map(k => Math.floor(max * (1 - 0.25 * k))) as [number, number, number];
  const woundText = wounds && c.woundsTreated ? WOUND_TEXT[wounds] + " Зараз знято лікуванням." : WOUND_TEXT[wounds];
  return { max, wounds, state, label, level, marks, deathAt: -Math.ceil(max / 4), checkPen, eff, lines, halves, radStage, weight, cap, over, woundText, vodkaOut, nextVodkaOut };
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
  /** id of the character's weapon the shot is fired from; "" when none is picked */
  weapon: string;
  mode: FireMode;
  /** attachments of kind "other" switched on for this shot, by id */
  mods: string[];
}
export const SHOT0: ShotOpts = { skill: "rifles", shot: "aimed", sit: false, optic: false, colim: false, near: "far", cover: "0", tprone: false, vis: false, invis: false, lying: false, rounds: 0, nato: false, jam: 0, extra: 0, weapon: "", mode: "single", mods: [] };

/** Fire modes from the rules: how many shots one action fires and the penalty on each. */
export type FireMode = "single" | "semi" | "burst" | "auto";
export const FIRE_MODES: { key: FireMode; name: string; pens: number[] }[] = [
  { key: "single", name: "Одиночний", pens: [0] },
  { key: "semi", name: "Напівавтомат", pens: [0, 0] },
  { key: "burst", name: "Черга з трьох", pens: [0, -1, -1] },
  // automatic fire: −1 more for every shot after the first
  { key: "auto", name: "Автомат", pens: [0, -1, -2, -3, -4] },
];
/** Which modes a weapon has, read from its free-text modes ("напівавтомат, автомат, по 3"). Unknown text allows all. */
export function weaponModes(modes: string): FireMode[] {
  const parts = String(modes || "").toLowerCase().split(/[,/;]+/).map(s => s.trim()).filter(Boolean);
  const out = new Set<FireMode>(["single"]);
  let known = false;
  for (const p of parts) {
    if (p.startsWith("напів")) { out.add("semi"); known = true; }
    else if (p.startsWith("автомат")) { out.add("auto"); known = true; }
    else if (p.includes("по 3") || p.includes("черг") || p.includes("відсіч")) { out.add("burst"); known = true; }
    else if (p.startsWith("одиноч") || p.startsWith("одинич")) known = true;
  }
  return known ? FIRE_MODES.map(m => m.key).filter(k => out.has(k)) : FIRE_MODES.map(m => m.key);
}

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
  /** every shot of the chosen fire mode: what the die must show and the chance */
  shots: { need: number; chance: number }[];
}

const SHOT_SKILLS = ["rifles", "pistols", "heavy"] as const;
/** Ranged weapons on the body: the ones the calculator can fire. */
export const rangedWeapons = (c: Character) => c.weapons.filter(g => g.on && (SHOT_SKILLS as readonly string[]).includes(g.skill));
const gunOf = (c: Character, o: ShotOpts): Weapon | undefined => (o.weapon ? rangedWeapons(c).find(x => x.id === o.weapon) : undefined);
export const hasMod = (g: Weapon, kind: Weapon["mods"][number]["kind"]) => g.mods.some(m => m.kind === kind);

/**
 * Chance to draw a weapon quickly: к10 − Спритність must not exceed the weapon skill.
 * A bulky weapon adds 2 to the die, an ergonomic grip takes 2 off.
 */
export function quickDraw(c: Character, d: Derived, g: Weapon): number {
  const adj = (hasMod(g, "bulky") ? 2 : 0) - (hasMod(g, "grip") ? 2 : 0);
  return clamp((num(c.skills[g.skill]) + d.eff.spr - adj) / 10, 0, 1);
}

/**
 * The options as they apply. A picked weapon decides the skill, NATO bonus, jams and fire modes, and a scope or a
 * collimator counts only if the weapon has one.
 */
export function resolveShot(c: Character, o: ShotOpts): ShotOpts {
  const base = { ...o, mods: Array.isArray(o.mods) ? o.mods : [] };
  const g = gunOf(c, base);
  if (!g) return { ...base, weapon: "" };
  const modes = weaponModes(g.modes);
  return {
    ...base,
    skill: g.skill as ShotOpts["skill"], nato: !!g.nato, jam: clamp(num(g.jams), 0, 2),
    mode: modes.includes(base.mode) ? base.mode : "single",
    optic: base.optic && hasMod(g, "optic"),
    colim: base.colim && hasMod(g, "colim"),
  };
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
  if (c.mask) P("протигаз", -1);
  for (const md of gunOf(c, o)?.mods ?? []) {
    if (!o.mods.includes(md.id) || !num(md.bonus)) continue;
    if (md.kind === "other" || (md.kind === "laser" && o.mode !== "auto")) P(md.name.toLowerCase(), num(md.bonus));
  }
  if (o.vis) P("погана видимість", -2);
  if (o.invis) P("ціль невидима", -3);
  const gw = gunOf(c, o);
  if (o.lying && !(gw && hasMod(gw, "bipod"))) P("стрільба лежачи", -2);
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
  const g = gunOf(c, o);
  // АН-94 fires its burst of three without the −1
  const pens = o.mode === "burst" && g && hasMod(g, "burst0") ? [0, 0, 0] : (FIRE_MODES.find(m => m.key === o.mode) ?? FIRE_MODES[0]).pens;
  const shots = pens.map(p => ({ need: 9 - mod - p, chance: clamp((mod + p + 2) / 10, 0, 1) }));
  return { parts, mod, need: 9 - mod, chance, chanceReroll, reroll, rerollBonus: rb, shots };
}

/* ---------- gear ---------- */
export function addMarketItem(c: Character, m: MarketEntry): void {
  if (m.ammo && m.cal && m.pack) {
    const it = c.items.find(x => x.ammo && x.cal === m.cal);
    if (it) it.qty = num(it.qty) + m.pack;
    else c.items.push({ id: uid(), name: "Набої " + m.cal, qty: m.pack, w: Math.round(10000 / m.pack) / 10000, cal: m.cal, ammo: true, note: m.d ?? "" });
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
export const newMod = (p: ModPreset) => ({ id: uid(), name: p.name, kind: p.kind, bonus: p.bonus });
/** Copies a catalogue armour into the sheet, not worn yet. */
export function addArmor(c: Character, a: CatArmor, id = uid()): void {
  c.armors.push({ id, name: a.n, kin: a.kin, acid: a.acid, fire: a.fire, elec: a.elec, rad: a.rad, w: a.w, countW: true, slots: a.slots, on: false, ...(a.note ? { note: a.note } : {}) });
}
export function addGun(c: Character, g: GunEntry = CUSTOM_GUN, id = uid()): void {
  c.weapons.push({ id, name: g.n, skill: g.skill, dmg: g.dmg, mag: g.mag, cur: g.mag, modes: g.modes, range: g.range, w: g.w, cal: g.cal, nato: !!g.nato, jams: 0, note: g.note, on: true, mods: (g.mods ?? []).map(k => newMod(modPreset(k))) });
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
  // ordinary rounds first; armour-piercing ones («… БП») of the same calibre when the ordinary have run out
  const cal = normCal(g.cal), is = (k: string) => (x: Item) => !!x.ammo && normCal(x.cal ?? "") === k;
  const it = c.items.find(x => is(cal)(x) && num(x.qty) > 0) ?? c.items.find(x => is(cal + "бп")(x) && num(x.qty) > 0) ?? c.items.find(is(cal));
  if (!it) { g.cur = mag; return `Набоїв ${g.cal || "цього калібру"} у рюкзаку немає, запас не списано.`; }
  const take = Math.min(need, num(it.qty));
  if (take <= 0) return "Набої в рюкзаку скінчилися.";
  it.qty = num(it.qty) - take; g.cur = num(g.cur) + take;
  return `Заряджено ${take}${is(cal + "бп")(it) ? " бронебійних" : ""}, у рюкзаку лишилось ${it.qty}.`;
}

/* ---------- luck ---------- */
/** What each use of luck costs: ±1 on a check, a reroll of one к10, an automatic success or enemy failure. */
export const LUCK_COST = { bonus: 1, reroll: 3, auto: 5 } as const;
export type LuckUse = keyof typeof LUCK_COST;
export const LUCK_DAWN = 2;
export const LUCK_DAWN_SAFE = 3;

/** Spends luck on one use; returns false and changes nothing when there is not enough. */
export function spendLuck(c: Character, use: LuckUse): boolean {
  const cost = LUCK_COST[use];
  if (num(c.luck.cur) < cost) return false;
  c.luck.cur = num(c.luck.cur) - cost;
  return true;
}
/** Dawn at 6:00: +2, or +3 after more than 12 hours in a safe zone, never above the pool. Returns what came back. */
export function dawnLuck(c: Character, safe: boolean): number {
  const before = num(c.luck.cur);
  c.luck.cur = Math.min(num(c.luck.pool), before + (safe ? LUCK_DAWN_SAFE : LUCK_DAWN));
  return Math.max(0, c.luck.cur - before);
}
/** Changes the pool; what is left never exceeds it. */
export function setLuckPool(c: Character, pool: number): void {
  c.luck.pool = clamp(Math.round(pool), 0, 99);
  c.luck.cur = clamp(num(c.luck.cur), 0, c.luck.pool);
}

/* ---------- creation wizard ---------- */
export interface Draft {
  step: number;
  d: Character;
  /** how many of each catalogue entry is in the basket, by catalogue id: items, guns, armours */
  cart: { m: Record<string, number>; g: Record<string, number>; a: Record<string, number> };
  /** an optional backstory ability typed on the first step */
  ab: { name: string; text: string };
}
export const newDraft = (): Draft => ({ step: 0, d: blankCharacter(), cart: { m: {}, g: {}, a: {} }, ab: { name: "", text: "" } });

/** A stored basket in today's shape. Baskets saved before the catalogue counted by list position: "3" becomes "m-3". */
export function migrateCart(raw: unknown): Draft["cart"] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fix = (r: unknown, p: string) => Object.fromEntries(Object.entries((r && typeof r === "object" ? r : {}) as Record<string, unknown>)
    .map(([k, v]) => [/^\d+$/.test(k) ? `${p}-${k}` : k, num(v)] as [string, number]).filter(([, v]) => v > 0));
  return { m: fix(o.m, "m"), g: fix(o.g, "g"), a: fix(o.a, "a") };
}

/** Basket lines that still exist in the catalogue, with their entries. */
function cartLines(w: Draft, cat: Catalog) {
  const pick = <T extends { id: string }>(r: Record<string, number> | undefined, from: T[]) =>
    Object.entries(r ?? {}).map(([k, q]) => ({ e: from.find(x => x.id === k), q: num(q) })).filter((x): x is { e: T; q: number } => !!x.e && x.q > 0);
  return { m: pick(w.cart.m, cat.items), g: pick(w.cart.g, cat.guns), a: pick(w.cart.a, cat.armors) };
}

export function cartTotals(w: Draft, cat: Catalog = DEFAULT_CATALOG): { cost: number; weight: number } {
  const l = cartLines(w, cat);
  let cost = 0, weight = 0;
  for (const { e, q } of l.m) { cost += e.p * q; weight += (e.ammo ? 1 : e.w ?? 0) * q; }
  for (const { e, q } of l.g) { cost += e.p * q; weight += e.w * q; }
  for (const { e, q } of l.a) { cost += e.p * q; weight += e.w * q; }
  return { cost, weight };
}
export const attrLeft = (c: Character) => ATTR_PTS - attrSpent(c);
export const skillLeft = (c: Character) => SKILL_PTS - skillSpent(c);
export function draftGearList(w: Draft, cat: Catalog = DEFAULT_CATALOG): string[] {
  const l = cartLines(w, cat);
  return [...l.m.map(({ e, q }) => `${marketName(e)} ×${q}`), ...l.g.map(({ e, q }) => `${e.n} ×${q}`), ...l.a.map(({ e, q }) => `${e.n} ×${q}`)];
}

/** Turns a finished draft into a sheet: buys the basket, banks leftover points, fills health. */
export function finishDraft(w: Draft, cat: Catalog = DEFAULT_CATALOG): Character {
  const c = migrate(w.d);
  const t = cartTotals(w, cat), l = cartLines(w, cat);
  for (const { e, q } of l.m) for (let n = 0; n < q; n++) addMarketItem(c, e);
  for (const { e, q } of l.g) for (let n = 0; n < q; n++) addGun(c, e);
  for (const { e, q } of l.a) for (let n = 0; n < q; n++) addArmor(c, e);
  c.money = c.money - t.cost;
  c.freeAttr = Math.max(0, attrLeft(c));
  c.freeSkill = Math.max(0, skillLeft(c));
  c.hp = maxHp(c);
  setLuckPool(c, num(c.luck.pool));
  c.luck.cur = c.luck.pool; // a new character starts with the whole pool
  if (w.ab.name.trim()) c.abilities.push({ id: uid(), name: w.ab.name.trim(), text: w.ab.text.trim() });
  c.createdAt = c.updatedAt = Date.now();
  return c;
}
