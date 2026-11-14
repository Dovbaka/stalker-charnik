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
  w: number;
  cal: string;
  nato: boolean;
  jams: number;
  note: string;
}

export interface Artifact { id: string; name: string; fx: string }
export interface Ability { id: string; name: string; text: string }

export interface Armor {
  name: string;
  kin: number; acid: number; fire: number; elec: number; rad: number;
  w: number;
  countW: boolean;
  slots: number;
  mask: boolean;
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
  armor: Armor;
  weapons: Weapon[];
  items: Item[];
  artifacts: Artifact[];
  abilities: Ability[];
  /** a backstory perk: reroll a missed shot with a bonus */
  reroll: { skill: RerollSkill; bonus: number };
  notes: string;
  createdAt: number;
  updatedAt: number;
}
