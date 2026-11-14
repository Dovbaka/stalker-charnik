export type AttrKey = "spr" | "til" | "spy" | "rea" | "mud";

export type SkillKey =
  | "pistols" | "rifles" | "heavy" | "melee" | "unarmed"
  | "barter" | "deceit" | "persuade"
  | "medicine" | "repair" | "scavenge" | "science"
  | "athletics" | "survival" | "sleight" | "stealth";

export type ItemEffect = "antirad" | "vodka" | "sci";

export interface Item {
  id: string;
  name: string;
  qty: number;
  /** weight of one unit, kg */
  w: number;
  note: string;
  /** uses left in the opened kit (first-aid kits, MRE) */
  uses?: number;
  max?: number;
  fx?: ItemEffect;
  ammo?: boolean;
  cal?: string;
}

export interface Weapon {
  id: string;
  name: string;
  skill: SkillKey;
  dmg: string;
  mag: number;
  cur: number;
  modes: string;
  /** Близька, Коротка, Середня, Далека, Екстремальна */
  range: string;
  w: number;
  cal: string;
  nato: boolean;
  jams: number;
  note: string;
  /** carried on the body and ready, as opposed to packed away; any number may be */
  on: boolean;
  /** scopes, silencers, bipods and the like */
  mods: WeaponMod[];
}

/**
 * An attachment. Scopes and collimators carry the rules' own +1; "other" carries whatever bonus the GM sets,
 * and shows in the shot calculator only when that bonus is not 0. A silencer changes no roll.
 */
export type ModKind =
  | "optic" | "colim" | "laser" | "silencer"        // attachments that change a roll or detection
  | "grip" | "bulky" | "heavy"                       // handling and calibre
  | "bayonet" | "bigmag" | "doublemag" | "gl40"      // other attachments from the GM's earlier document
  | "bipod"                                          // no penalty for shooting prone
  | "burst0" | "reliable" | "fragile"                // features of particular weapons
  | "other";
export interface WeaponMod { id: string; name: string; kind: ModKind; bonus: number }

export interface Artifact { id: string; name: string; fx: string }
export interface Ability { id: string; name: string; text: string }

export interface Armor {
  id: string;
  name: string;
  kin: number; acid: number; fire: number; elec: number; rad: number;
  w: number;
  /** false only for the starting leather jacket, which the rules leave out of the load */
  countW: boolean;
  slots: number;
  /** special rules: worn over a suit, a helmet included, penalties */
  note?: string;
  /** the one being worn; at most one armour is */
  on: boolean;
}

export type RerollSkill = "" | "rifles" | "pistols" | "heavy" | "any";

/** One character sheet, exactly as it is stored in Firestore under `chars/{id}.char`. */
export interface Character {
  v: number;
  cid: string;
  id: { callsign: string; name: string; role: string; age: string; looks: string; about: string };
  attrs: Record<AttrKey, number>;
  /** artefacts, lasting injuries and other manual modifiers */
  attrMod: Record<AttrKey, number>;
  skills: Record<SkillKey, number>;
  zone: number;
  freeSkill: number;
  freeAttr: number;
  hp: number;
  woundsTreated: boolean;
  bleed: number;
  rad: number;
  vodka: number;
  noSleep: number;
  noFood: number;
  noWater: number;
  conditions: string;
  money: number;
  armors: Armor[];
  /** a gas mask is on: +5 against radiation, −1 to hit */
  mask: boolean;
  weapons: Weapon[];
  items: Item[];
  artifacts: Artifact[];
  abilities: Ability[];
  /** a backstory perk: reroll a missed shot with a bonus */
  reroll: { skill: RerollSkill; bonus: number };
  /** the GM's optional luck rule: a pool rolled once (5 + к4), `cur` is what is left of it */
  luck: { pool: number; cur: number };
  notes: string;
  createdAt: number;
  updatedAt: number;
}
