// The GM's catalogue: what players can add to a sheet or buy at creation.
// It is one Firestore document, `catalog/main`, that only the GM can write. Until the GM first changes it,
// the built-in lists from the rules documents stand in for it.
// Taking a thing from the catalogue copies it into the sheet: later catalogue edits never touch sheets, and back.
import { ARMORS, ARTIFACTS, ART_FX_INFO, ART_RARITY, ART_TYPES, GUNS, GUN_GROUPS, MARKET, MOD_INFO, WEAPON_SKILLS, type ArmorEntry, type ArtifactEntry, type GunEntry, type MarketEntry } from "./data";
import type { ArtFx, ArtRarity, ArtType, ItemEffect, ModKind, SkillKey } from "./types";
import { uid } from "../util";

export interface CatGun extends GunEntry { id: string; hidden?: boolean }
export interface CatItem extends MarketEntry { id: string; hidden?: boolean }
export interface CatArmor extends ArmorEntry { id: string; hidden?: boolean }
export interface CatArtifact extends ArtifactEntry { id: string; hidden?: boolean }
export interface Catalog { guns: CatGun[]; items: CatItem[]; armors: CatArmor[]; artifacts: CatArtifact[] }
export type CatKind = keyof Catalog;

// Built-in entries are numbered by position, so a creation basket saved before the catalogue existed still finds them.
export const DEFAULT_CATALOG: Catalog = {
  guns: GUNS.map((g, i) => ({ ...g, id: `g-${i}` })),
  items: MARKET.map((m, i) => ({ ...m, id: `m-${i}` })),
  armors: ARMORS.map((a, i) => ({ ...a, id: `a-${i}` })),
  artifacts: ARTIFACTS.map((a, i) => ({ ...a, fx: { ...a.fx }, id: `r-${i}` })),
};

export const ITEM_FX: [ItemEffect | "", string][] = [["", "немає"], ["antirad", "антирад: −250 рад"], ["vodka", "горілка: −100 рад, +1 алкоголь"], ["sci", "наукова аптечка: −250 рад"]];

/** What a player sees: the GM hides entries that are not open to players yet. */
export function forViewer(cat: Catalog, gm: boolean): Catalog {
  if (gm) return cat;
  return { guns: cat.guns.filter(x => !x.hidden), items: cat.items.filter(x => !x.hidden), armors: cat.armors.filter(x => !x.hidden), artifacts: cat.artifacts.filter(x => !x.hidden) };
}

/** Item groups in the order they first appear. */
export function itemGroups(items: CatItem[]): string[] {
  const out: string[] = [];
  for (const m of items) if (!out.includes(m.g)) out.push(m.g);
  return out;
}
/** Weapon groups: the rules' own first, then any the GM made up. */
export function gunGroups(guns: CatGun[]): string[] {
  const out = [...GUN_GROUPS];
  for (const g of guns) if (!out.includes(g.g)) out.push(g.g);
  return out;
}

export const newCatGun = (): CatGun => ({ id: uid(), n: "Нова зброя", g: GUN_GROUPS[1], skill: "rifles", range: "Середня", mag: 10, dmg: "2к10", modes: "одиночний", w: 4, cal: "", p: 0, note: "", mods: [] });
export const newCatItem = (): CatItem => ({ id: uid(), g: "Різне", n: "Нова річ", w: 0, p: 0 });
export const newCatArmor = (): CatArmor => ({ id: uid(), n: "Нова броня", kin: 0, acid: 0, fire: 0, elec: 0, rad: 0, w: 0, slots: 0, p: 0 });
/** A new artefact keeps its properties from players until the GM unticks that. */
export const newCatArtifact = (): CatArtifact => ({ id: uid(), n: "Новий артефакт", type: "grav", rarity: "common", d: "", note: "", fx: {}, p: 0, secret: true });

/* ---------- reading a stored catalogue: anything missing or malformed gets a safe value ---------- */
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const nr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown) => (Array.isArray(v) ? v.map(rec) : []);
const FX = new Set<string>(["antirad", "vodka", "sci"]);

function readGun(o: Record<string, unknown>): CatGun {
  const skill = (WEAPON_SKILLS as string[]).includes(str(o.skill)) ? (o.skill as SkillKey) : "rifles";
  const mods = (Array.isArray(o.mods) ? o.mods : []).filter((k): k is ModKind => typeof k === "string" && k in MOD_INFO && k !== "other");
  const g: CatGun = { id: str(o.id) || uid(), n: str(o.n, "Зброя"), g: str(o.g, GUN_GROUPS[1]), skill, range: str(o.range), mag: nr(o.mag), dmg: str(o.dmg), modes: str(o.modes), w: nr(o.w), cal: str(o.cal), p: nr(o.p), note: str(o.note), mods };
  if (o.nato) g.nato = true;
  if (o.hidden) g.hidden = true;
  return g;
}
function readItem(o: Record<string, unknown>): CatItem {
  const m: CatItem = { id: str(o.id) || uid(), g: str(o.g, "Різне"), p: nr(o.p) };
  if (o.ammo) { m.ammo = true; m.cal = str(o.cal); m.pack = Math.max(1, nr(o.pack, 1)); }
  else { m.n = str(o.n, "Річ"); m.w = nr(o.w); }
  if (str(o.d)) m.d = str(o.d);
  if (nr(o.uses) > 0) m.uses = nr(o.uses);
  if (FX.has(str(o.fx))) m.fx = o.fx as ItemEffect;
  if (o.hidden) m.hidden = true;
  return m;
}
function readArmor(o: Record<string, unknown>): CatArmor {
  const a: CatArmor = { id: str(o.id) || uid(), n: str(o.n, "Броня"), kin: nr(o.kin), acid: nr(o.acid), fire: nr(o.fire), elec: nr(o.elec), rad: nr(o.rad), w: nr(o.w), slots: Math.min(5, Math.max(0, Math.round(nr(o.slots)))), p: nr(o.p) };
  if (str(o.note)) a.note = str(o.note);
  if (o.hidden) a.hidden = true;
  return a;
}

const ART_TYPE_KEYS = new Set<string>(ART_TYPES.map(t => t[0])), ART_RARITY_KEYS = new Set<string>(ART_RARITY.map(r => r[0]));
/** Only known effects with a number; a 0 the GM is still typing over stays. */
export function readArtFx(v: unknown): ArtFx {
  const o = rec(v), fx: ArtFx = {};
  for (const { key } of ART_FX_INFO) if (typeof o[key] === "number" && Number.isFinite(o[key])) fx[key] = Math.round(o[key] as number);
  return fx;
}
function readArtifact(o: Record<string, unknown>): CatArtifact {
  const a: CatArtifact = {
    id: str(o.id) || uid(), n: str(o.n, "Артефакт"),
    type: ART_TYPE_KEYS.has(str(o.type)) ? (o.type as ArtType) : "unique", rarity: ART_RARITY_KEYS.has(str(o.rarity)) ? (o.rarity as ArtRarity) : "common",
    d: str(o.d), note: str(o.note), fx: readArtFx(o.fx), p: nr(o.p), secret: o.secret !== false,
  };
  if (o.hidden) a.hidden = true;
  return a;
}

/** The stored document as a catalogue; null when there is none yet. A document saved before artefacts existed gets the built-in ones. */
export function readCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== "object") return null;
  const o = rec(raw);
  return {
    guns: list(o.guns).map(readGun), items: list(o.items).map(readItem), armors: list(o.armors).map(readArmor),
    artifacts: Array.isArray(o.artifacts) ? list(o.artifacts).map(readArtifact) : structuredClone(DEFAULT_CATALOG.artifacts),
  };
}
