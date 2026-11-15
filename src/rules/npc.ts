// The GM's NPCs: a compendium of statblocks, and encounters built from them.
// A statblock is a kind of enemy as the GM's document writes it, with its weapon tables (к10) and loot formulas.
// An encounter holds foes: each is one copy of a statblock with its own health, weapons, rounds and loot.
// Attack rolls stay at the table; only gear, rounds and loot can be rolled here (owner, 2026-11-15).
// Pure functions: no React, no Firebase. Functions that take a foe or an encounter and return nothing mutate it.
import { clamp, num, uid } from "../util";
import { addGun, reload, type DamageType } from "./character";
import type { Catalog, CatGun } from "./catalog";
import { ATTR_KEYS, MOD_INFO, SKILL_KEYS } from "./data";
import type { AttrKey, Item, ModKind, SkillKey, Weapon } from "./types";

export type NpcKind = "human" | "mutant";
/** Main action, additional action, free action: the rules' three kinds. */
export type ActKind = "main" | "bonus" | "free";
export const ACT_KINDS: [ActKind, string][] = [["main", "Основні дії"], ["bonus", "Додаткові дії"], ["free", "Вільні дії"]];
/** Skills of a statblock: the sheet's skills plus Знання Зони, which a sheet keeps apart. */
export type NpcSkillKey = SkillKey | "zone";
export const NPC_SKILL_KEYS: NpcSkillKey[] = [...SKILL_KEYS, "zone"];
export interface Prot { kin: number; acid: number; fire: number; elec: number; rad: number }
export const PROT_KEYS: (keyof Prot)[] = ["kin", "acid", "fire", "elec", "rad"];
export const PROT_NAME: Record<keyof Prot, string> = { kin: "Кінетика", acid: "Кислота", fire: "Вогонь", elec: "Електрика", rad: "Радіація" };

export interface NpcAction {
  id: string;
  kind: ActKind;
  name: string;
  /** what is added to к10 to hit; null when the action is not an attack roll */
  atk: number | null;
  /** damage formula, "к5+2"; "" when none */
  dmg: string;
  text: string;
}
/** One line of a weapon table: on к10 from `lo` to `hi` the NPC carries this catalogue weapon. */
export interface NpcGun { id: string; lo: number; hi: number; /** catalogue id */ gun: string; /** the name, kept in case the catalogue entry goes */ n: string; mods: ModKind[] }
/** Rounds of one calibre in the loot, as a formula: "20+к10". */
export interface NpcAmmo { id: string; cal: string; f: string }
export interface NpcLootItem { id: string; n: string; q: number }

export interface NpcEntry {
  id: string;
  /** "Бандит (Пацан)" */
  n: string;
  /** "Бандити", "Мутанти" */
  g: string;
  kind: NpcKind;
  /** description */
  d: string;
  attrs: Record<AttrKey, number>;
  skills: Partial<Record<NpcSkillKey, number>>;
  hp: number;
  /** armour's name; "" for a mutant's own hide */
  armor: string;
  prot: Prot;
  /** additional and main weapon tables, к10 */
  side: NpcGun[];
  main: NpcGun[];
  /** what it always carries: a knife, grenades */
  gear: string;
  acts: NpcAction[];
  special: string;
  /** loot: rounds by calibre, money as a formula and its currency, things, and chances in words */
  ammo: NpcAmmo[];
  money: string;
  cur: string;
  items: NpcLootItem[];
  lootNote: string;
}

export const CURRENCIES = ["куп.", "$ або €"];
export const npcHp = (attrs: Record<AttrKey, number>) => num(attrs.til) * 5 + 10;
export function newNpc(kind: NpcKind): NpcEntry {
  const attrs = Object.fromEntries(ATTR_KEYS.map(k => [k, 3])) as Record<AttrKey, number>;
  return {
    id: uid(), n: "", g: kind === "mutant" ? "Мутанти" : "", kind, d: "", attrs, skills: {}, hp: npcHp(attrs),
    armor: "", prot: { kin: 0, acid: 0, fire: 0, elec: 0, rad: 0 }, side: [], main: [], gear: "", acts: [], special: "",
    ammo: [], money: "", cur: CURRENCIES[0], items: [], lootNote: "",
  };
}

/**
 * Skills as they count. A mutant's Без зброї equals its Тілобудова and its Атлетика its Реакція (the rules),
 * whatever the statblock says.
 */
export function npcSkills(e: Pick<NpcEntry, "kind" | "attrs" | "skills">): Record<NpcSkillKey, number> {
  const s = Object.fromEntries(NPC_SKILL_KEYS.map(k => [k, num(e.skills[k])])) as Record<NpcSkillKey, number>;
  if (e.kind === "mutant") { s.unarmed = num(e.attrs.til); s.athletics = num(e.attrs.rea); }
  return s;
}

/* ---------- dice ---------- */
/**
 * Rolls a formula from the GM's tables: "20+к10", "2к10", "к10*100", "4к10*10", "к5+2". The Latin "d" and "k" work too.
 * Returns null for anything else.
 */
export function rollFormula(f: string, rnd: () => number = Math.random): number | null {
  const s = String(f || "").toLowerCase().replace(/\s+/g, "").replace(/[dkк]/g, "к").replace(/[×х]/g, "*");
  if (!s) return null;
  const [expr, mult, extra] = s.split("*");
  if (extra !== undefined || !expr) return null;
  const k = mult === undefined ? 1 : Number(mult);
  if (!Number.isInteger(k) || k <= 0) return null;
  const terms = expr.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join("") !== expr) return null;
  let total = 0;
  for (const t of terms) {
    const neg = t.startsWith("-"), body = t.replace(/^[+-]/, "");
    let v: number;
    const m = /^(\d*)к(\d+)$/.exec(body);
    if (m) {
      const n = m[1] ? Number(m[1]) : 1, sides = Number(m[2]);
      if (n < 1 || n > 100 || sides < 1) return null;
      v = 0;
      for (let i = 0; i < n; i++) v += 1 + Math.floor(rnd() * sides);
    } else if (/^\d+$/.test(body)) v = Number(body);
    else return null;
    total += neg ? -v : v;
  }
  return Math.max(0, total * k);
}

/* ---------- foes ---------- */
export interface FoeWeapon extends Weapon {
  /** which table it came from: additional, main, or added by hand */
  slot: "side" | "main" | "";
  /** the table line it came from */
  row: string;
}
export interface Foe {
  id: string;
  /** the statblock it was made from */
  npc: string;
  name: string;
  kind: NpcKind;
  hp: number;
  max: number;
  prot: Prot;
  attrs: Record<AttrKey, number>;
  skills: Record<NpcSkillKey, number>;
  weapons: FoeWeapon[];
  /** rounds in reserve (ammo: true) and the rest of the loot */
  items: Item[];
  money: number;
  cur: string;
  init: number | null;
  /** out of the fight: killed or fled */
  out: "" | "dead" | "fled";
  note: string;
}
/** A player's character in an encounter's initiative. */
export interface EncPc { id: string; char: string; init: number | null }
export interface Encounter {
  id: string;
  name: string;
  note: string;
  foes: Foe[];
  pcs: EncPc[];
  /** the initiative list in the order shown: ids of foes and of `pcs` rows */
  order: string[];
  /** whose turn it is: an id from `order`; "" before the fight starts */
  turn: string;
  /** 0 before the fight starts */
  round: number;
  createdAt: number;
  updatedAt: number;
}
export const newEncounter = (name: string, id = uid()): Encounter => ({ id, name, note: "", foes: [], pcs: [], order: [], turn: "", round: 0, createdAt: Date.now(), updatedAt: Date.now() });

const norm = (s: string) => String(s || "").toLowerCase().replace(/[«»"“”„'’`]/g, "").replace(/\s+/g, " ").trim();
const normCal = (s: string) => String(s || "").toLowerCase().replace(/[xх*]/g, "×").replace(/мм|\s/g, "");
/** The catalogue weapon a table line means: by id, or by name if the GM re-made the entry. */
export const catGun = (cat: Catalog, row: Pick<NpcGun, "gun" | "n">): CatGun | undefined =>
  cat.guns.find(g => g.id === row.gun) ?? cat.guns.find(g => norm(g.n) === norm(row.n));
/** The table line a к10 result picks; a table of one line always gives it. */
export function tableRow(rows: NpcGun[], d10: number): NpcGun | undefined {
  if (rows.length === 1) return rows[0];
  return rows.find(r => d10 >= r.lo && d10 <= r.hi);
}
/** A weapon from a table line, magazine full, the line's attachments added to the catalogue's own. */
export function foeWeapon(row: NpcGun, cat: Catalog, slot: FoeWeapon["slot"]): FoeWeapon {
  const tmp: { weapons: Weapon[] } = { weapons: [] };
  const g = catGun(cat, row);
  addGun(tmp, g ?? { n: row.n || "Зброя", g: "", skill: "rifles", range: "", mag: 0, dmg: "", modes: "", w: 0, cal: "", p: 0, note: "" });
  const w = tmp.weapons[0];
  for (const k of row.mods) if (!w.mods.some(m => m.kind === k)) w.mods.push({ id: uid(), name: MOD_INFO[k].name, kind: k, bonus: k === "optic" || k === "colim" || k === "laser" ? 1 : 0 });
  return { ...w, slot, row: row.id };
}
const ammoItem = (cal: string, qty: number): Item => ({ id: uid(), name: "Набої " + cal, qty, w: 0, note: "", ammo: true, cal });

/**
 * Rolls what the foe carries: a weapon from each table, rounds for those weapons (only calibres they fire),
 * and money. Things in the loot list are not rolled; they are kept as they are.
 */
export function rollGear(f: Foe, e: NpcEntry, cat: Catalog, rnd: () => number = Math.random): void {
  const d10 = () => 1 + Math.floor(rnd() * 10);
  const weapons: FoeWeapon[] = [];
  for (const slot of ["side", "main"] as const) {
    const row = tableRow(e[slot], d10());
    if (row) weapons.push(foeWeapon(row, cat, slot));
  }
  f.weapons = [...weapons, ...f.weapons.filter(w => !w.slot)];
  f.items = f.items.filter(it => !it.ammo);
  for (const a of e.ammo) {
    if (!f.weapons.some(w => w.cal && normCal(w.cal) === normCal(a.cal))) continue;
    const qty = rollFormula(a.f, rnd);
    if (qty != null) f.items.unshift(ammoItem(a.cal, qty));
  }
  f.money = rollFormula(e.money, rnd) ?? 0;
}
/** Swaps the weapon of one table for another line of it; rounds for a new calibre are rolled if the loot has them. */
export function setFoeWeapon(f: Foe, e: NpcEntry, cat: Catalog, slot: "side" | "main", rowId: string, rnd: () => number = Math.random): void {
  const row = e[slot].find(r => r.id === rowId);
  if (!row) return;
  const w = foeWeapon(row, cat, slot);
  const i = f.weapons.findIndex(x => x.slot === slot);
  if (i >= 0) f.weapons[i] = w; else f.weapons.splice(slot === "side" ? 0 : f.weapons.filter(x => x.slot === "side").length, 0, w);
  if (!w.cal || f.items.some(it => it.ammo && normCal(it.cal ?? "") === normCal(w.cal))) return;
  const a = e.ammo.find(x => normCal(x.cal) === normCal(w.cal));
  const qty = a ? rollFormula(a.f, rnd) : null;
  if (qty != null) f.items.unshift(ammoItem(w.cal, qty));
}

/** A new foe from a statblock, gear rolled. `n` numbers it among foes of the same statblock. */
export function makeFoe(e: NpcEntry, cat: Catalog, n: number, rnd: () => number = Math.random): Foe {
  const f: Foe = {
    id: uid(), npc: e.id, name: `${e.n} ${n}`, kind: e.kind, hp: num(e.hp), max: num(e.hp), prot: { ...e.prot },
    attrs: { ...e.attrs }, skills: npcSkills(e), weapons: [], items: e.items.filter(x => x.n.trim()).map(x => ({ id: uid(), name: x.n, qty: num(x.q, 1), w: 0, note: "" })),
    money: 0, cur: e.cur, init: null, out: "", note: "",
  };
  rollGear(f, e, cat, rnd);
  return f;
}
/** Adds `count` foes of one statblock to the end of the initiative list; returns their ids. */
export function addFoes(enc: Encounter, e: NpcEntry, cat: Catalog, count: number, rnd: () => number = Math.random): string[] {
  const used = enc.foes.filter(f => f.npc === e.id).length;
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const f = makeFoe(e, cat, used + i, rnd);
    enc.foes.push(f); enc.order.push(f.id); ids.push(f.id);
  }
  return ids;
}
/** Rounds of a weapon's calibre in the foe's reserve. */
export const foeReserve = (f: Foe, w: Weapon): Item | undefined => (w.cal ? f.items.find(it => it.ammo && normCal(it.cal ?? "") === normCal(w.cal)) : undefined);
/** Reloads from the reserve only: a foe without rounds of that calibre stays empty, unlike a sheet. Returns the line to show. */
export function foeReload(f: Foe, weaponId: string): string {
  const w = f.weapons.find(x => x.id === weaponId);
  if (!w) return "";
  const r = foeReserve(f, w);
  if (num(w.cur) >= num(w.mag)) return "Магазин повний.";
  if (!r || num(r.qty) <= 0) return "Запасних набоїв немає.";
  return reload(f, weaponId).replace("у рюкзаку", "у запасі");
}
/** Damage through the foe's protection. Health stops at 0; whether that kills is the GM's call. */
export function foeDamage(f: Foe, amount: number, type: DamageType): { real: number; absorbed: number } {
  const arm = type === "none" ? 0 : num(f.prot[type]);
  const real = Math.max(0, amount - arm);
  f.hp = clamp(f.hp - real, 0, f.max);
  return { real, absorbed: Math.max(0, Math.min(arm, amount)) };
}
export const foeHeal = (f: Foe, amount: number) => { f.hp = clamp(f.hp + amount, 0, f.max); };

/* ---------- initiative ---------- */
export interface Combatant { id: string; kind: "foe" | "pc"; init: number | null; rea: number; out: boolean }
/** The initiative list as stored, with any foe or player missing from it appended and stale ids dropped. */
export function combatants(enc: Encounter, rea: (charId: string) => number): Combatant[] {
  const all = new Map<string, Combatant>();
  for (const f of enc.foes) all.set(f.id, { id: f.id, kind: "foe", init: f.init, rea: num(f.attrs.rea), out: !!f.out });
  for (const p of enc.pcs) all.set(p.id, { id: p.id, kind: "pc", init: p.init, rea: rea(p.char), out: false });
  const out: Combatant[] = [];
  for (const id of enc.order) { const c = all.get(id); if (c) { out.push(c); all.delete(id); } }
  return [...out, ...all.values()];
}
/** Puts the list in initiative order: higher first, a tie goes to the higher Реакція (the rules), no number last. */
export function sortInitiative(enc: Encounter, rea: (charId: string) => number): void {
  const list = combatants(enc, rea);
  const key = (c: Combatant) => (c.init == null ? -Infinity : c.init);
  enc.order = [...list].sort((a, b) => key(b) - key(a) || b.rea - a.rea).map(c => c.id);
}
/** Starts the fight: sorted, round 1, the first in the list acts. */
export function startFight(enc: Encounter, rea: (charId: string) => number): void {
  sortInitiative(enc, rea);
  enc.round = 1;
  enc.turn = combatants(enc, rea).find(c => !c.out)?.id ?? "";
}
/** The next one who can act; past the end of the list a new round begins. Foes out of the fight are skipped. */
export function nextTurn(enc: Encounter, rea: (charId: string) => number): void {
  const list = combatants(enc, rea);
  if (!list.some(c => !c.out)) return;
  let i = list.findIndex(c => c.id === enc.turn);
  for (let step = 0; step < list.length; step++) {
    i++;
    if (i >= list.length) { i = 0; enc.round++; }
    if (!list[i].out) { enc.turn = list[i].id; return; }
  }
}
export function endFight(enc: Encounter): void { enc.round = 0; enc.turn = ""; }
/** Takes a foe or a player out of the encounter. */
export function removeCombatant(enc: Encounter, id: string, rea: (charId: string) => number): void {
  if (enc.turn === id) { nextTurn(enc, rea); if (enc.turn === id) enc.turn = ""; }
  enc.foes = enc.foes.filter(f => f.id !== id);
  enc.pcs = enc.pcs.filter(p => p.id !== id);
  enc.order = enc.order.filter(x => x !== id);
}
/** Adds every character not in the encounter yet; returns how many. */
export function addPcs(enc: Encounter, charIds: string[]): number {
  let n = 0;
  for (const char of charIds) {
    if (enc.pcs.some(p => p.char === char)) continue;
    const p: EncPc = { id: uid(), char, init: null };
    enc.pcs.push(p); enc.order.push(p.id); n++;
  }
  return n;
}

/* ---------- reading what is stored: anything missing or malformed gets a safe value ---------- */
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const nr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown) => (Array.isArray(v) ? v.map(rec) : []);
const ACT_KEYS = new Set<string>(ACT_KINDS.map(a => a[0]));
const readAttrs = (v: unknown) => { const o = rec(v); return Object.fromEntries(ATTR_KEYS.map(k => [k, nr(o[k])])) as Record<AttrKey, number>; };
const readProt = (v: unknown): Prot => { const o = rec(v); return { kin: nr(o.kin), acid: nr(o.acid), fire: nr(o.fire), elec: nr(o.elec), rad: nr(o.rad) }; };
const readMods = (v: unknown) => (Array.isArray(v) ? v : []).filter((k): k is ModKind => typeof k === "string" && k in MOD_INFO);
const readGuns = (v: unknown): NpcGun[] => list(v).map(o => ({ id: str(o.id) || uid(), lo: clamp(Math.round(nr(o.lo, 1)), 1, 10), hi: clamp(Math.round(nr(o.hi, 10)), 1, 10), gun: str(o.gun), n: str(o.n), mods: readMods(o.mods) }));

export function readNpc(o: Record<string, unknown>): NpcEntry {
  const skills: NpcEntry["skills"] = {}, so = rec(o.skills);
  for (const k of NPC_SKILL_KEYS) if (nr(so[k])) skills[k] = nr(so[k]);
  return {
    id: str(o.id) || uid(), n: str(o.n, "NPC"), g: str(o.g), kind: o.kind === "mutant" ? "mutant" : "human", d: str(o.d),
    attrs: readAttrs(o.attrs), skills, hp: nr(o.hp), armor: str(o.armor), prot: readProt(o.prot),
    side: readGuns(o.side), main: readGuns(o.main), gear: str(o.gear),
    acts: list(o.acts).map(a => ({ id: str(a.id) || uid(), kind: ACT_KEYS.has(str(a.kind)) ? (a.kind as ActKind) : "main", name: str(a.name), atk: typeof a.atk === "number" && Number.isFinite(a.atk) ? a.atk : null, dmg: str(a.dmg), text: str(a.text) })),
    special: str(o.special),
    ammo: list(o.ammo).map(a => ({ id: str(a.id) || uid(), cal: str(a.cal), f: str(a.f) })),
    money: str(o.money), cur: str(o.cur, CURRENCIES[0]),
    items: list(o.items).map(a => ({ id: str(a.id) || uid(), n: str(a.n), q: Math.max(0, Math.round(nr(a.q, 1))) })),
    lootNote: str(o.lootNote),
  };
}
/** The stored compendium (`gm/npcs`); an empty one until the GM fills it. */
export function readNpcs(raw: unknown): NpcEntry[] {
  return list(rec(raw).list).map(readNpc);
}

function readWeapon(o: Record<string, unknown>): FoeWeapon {
  const skill = (SKILL_KEYS as string[]).includes(str(o.skill)) ? (o.skill as SkillKey) : "rifles";
  return {
    id: str(o.id) || uid(), name: str(o.name, "Зброя"), skill, dmg: str(o.dmg), mag: nr(o.mag), cur: nr(o.cur), modes: str(o.modes), range: str(o.range),
    w: nr(o.w), cal: str(o.cal), nato: !!o.nato, jams: nr(o.jams), note: str(o.note), on: o.on !== false,
    mods: list(o.mods).map(m => ({ id: str(m.id) || uid(), name: str(m.name), kind: (str(m.kind) in MOD_INFO ? m.kind : "other") as ModKind, bonus: nr(m.bonus) })),
    slot: o.slot === "side" || o.slot === "main" ? o.slot : "", row: str(o.row),
  };
}
function readFoe(o: Record<string, unknown>): Foe {
  const s = rec(o.skills);
  return {
    id: str(o.id) || uid(), npc: str(o.npc), name: str(o.name, "Ворог"), kind: o.kind === "mutant" ? "mutant" : "human",
    hp: nr(o.hp), max: nr(o.max), prot: readProt(o.prot), attrs: readAttrs(o.attrs),
    skills: Object.fromEntries(NPC_SKILL_KEYS.map(k => [k, nr(s[k])])) as Record<NpcSkillKey, number>,
    weapons: list(o.weapons).map(readWeapon),
    items: list(o.items).map(it => {
      const x: Item = { id: str(it.id) || uid(), name: str(it.name), qty: nr(it.qty), w: nr(it.w), note: str(it.note) };
      if (it.ammo) { x.ammo = true; x.cal = str(it.cal); }
      return x;
    }),
    money: nr(o.money), cur: str(o.cur, CURRENCIES[0]), init: typeof o.init === "number" && Number.isFinite(o.init) ? o.init : null,
    out: o.out === "dead" || o.out === "fled" ? o.out : "", note: str(o.note),
  };
}
/** A stored encounter (`encounters/{id}`). */
export function readEncounter(id: string, raw: unknown): Encounter {
  const o = rec(raw);
  return {
    id, name: str(o.name, "Енкаунтер"), note: str(o.note), foes: list(o.foes).map(readFoe),
    pcs: list(o.pcs).map(p => ({ id: str(p.id) || uid(), char: str(p.char), init: typeof p.init === "number" && Number.isFinite(p.init) ? p.init : null })),
    order: (Array.isArray(o.order) ? o.order : []).filter((x): x is string => typeof x === "string"),
    turn: str(o.turn), round: Math.max(0, Math.round(nr(o.round))), createdAt: nr(o.createdAt), updatedAt: nr(o.updatedAt),
  };
}
