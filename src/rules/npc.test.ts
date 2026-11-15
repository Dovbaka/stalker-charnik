import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG } from "./catalog";
import { resolveShot, shotCalc, SHOT0 } from "./character";
import { foeReload, addFoes, addPcs, combatants, endFight, foeDamage, makeFoe, newEncounter, newNpc, nextTurn, npcSkills, readEncounter, readNpcs, removeCombatant, rollFormula, rollGear, setFoeWeapon, sortInitiative, startFight, type NpcEntry } from "./npc";

/** Dice that come up as listed: each number is a к10 result (a к100 or к5 reads the same fraction). */
const dice = (...d10s: number[]) => { let i = 0; return () => (d10s[i++ % d10s.length] - 1) / 10 + 0.05; };
const gun = (n: string) => DEFAULT_CATALOG.guns.find(g => g.n === n)!.id;

/** «Бандит (Пацан)» as the GM's document writes it. */
function pacan(): NpcEntry {
  const e = newNpc("human");
  Object.assign(e, {
    id: "pacan", n: "Бандит (Пацан)", g: "Бандити", hp: 25, armor: "Бандитська куртка", prot: { kin: 3, acid: 3, fire: 3, elec: 0, rad: 0 },
    attrs: { spr: 3, til: 3, spy: 3, rea: 4, mud: 3 }, skills: { pistols: 1, rifles: 2, melee: 1, survival: 1, repair: 1, athletics: 1, zone: 1 },
    side: [{ id: "s1", lo: 1, hi: 9, gun: gun("Макаров (ПМм)"), n: "Макаров (ПМм)", mods: [] }, { id: "s2", lo: 10, hi: 10, gun: gun("Стєчкін (АПС)"), n: "Стєчкін (АПС)", mods: [] }],
    main: [
      { id: "m1", lo: 1, hi: 5, gun: gun("Обріз"), n: "Обріз", mods: [] },
      { id: "m2", lo: 6, hi: 8, gun: gun("Мисливська рушниця"), n: "Мисливська рушниця", mods: [] },
      { id: "m3", lo: 9, hi: 9, gun: gun("MP-5"), n: "MP-5", mods: [] },
      { id: "m4", lo: 10, hi: 10, gun: "gone", n: "АКМ 74/2 У", mods: ["silencer"] },
    ],
    ammo: [{ id: "a1", cal: "9×18", f: "20+к10" }, { id: "a2", cal: "12×70 дріб", f: "20+к10" }, { id: "a3", cal: "9×19", f: "30+к10" }, { id: "a4", cal: "5.45×39", f: "30+к10" }],
    money: "2к10", items: [{ id: "i1", n: "Вода, 0,5 л", q: 1 }, { id: "i2", n: "Консерва «Радість туриста»", q: 2 }],
  });
  return e;
}

describe("dice formulas from the GM's tables", () => {
  it("rolls sums, dice counts and multipliers", () => {
    expect(rollFormula("20+к10", dice(7))).toBe(27);
    expect(rollFormula("2к10", dice(3, 9))).toBe(12);
    expect(rollFormula("к10*100", dice(4))).toBe(400);
    expect(rollFormula("4к10*10", dice(1, 2, 3, 4))).toBe(100);
    expect(rollFormula("2d10 + 3", dice(5, 5))).toBe(13);
    expect(rollFormula("40", dice(1))).toBe(40);
  });
  it("refuses what it cannot read", () => {
    for (const f of ["", "багато", "к", "2к10**2", "20++к10", "к10*0"]) expect(rollFormula(f)).toBeNull();
  });
});

describe("foes", () => {
  it("a foe rolls a weapon from each table and rounds only for the calibres it fires", () => {
    // к10: side 10 → АПС, main 3 → Обріз; then 9×18 20+5, 12×70 20+6; money 2к10 = 4+8
    const f = makeFoe(pacan(), DEFAULT_CATALOG, 1, dice(10, 3, 5, 6, 4, 8));
    expect(f.name).toBe("Бандит (Пацан) 1");
    expect(f.weapons.map(w => [w.name, w.slot, w.cur])).toEqual([["Стєчкін (АПС)", "side", 20], ["Обріз", "main", 2]]);
    expect(f.items.filter(i => i.ammo).map(i => [i.cal, i.qty])).toEqual([["12×70 дріб", 26], ["9×18", 25]]);
    expect(f.money).toBe(12);
    expect(f.items.filter(i => !i.ammo).map(i => [i.name, i.qty])).toEqual([["Вода, 0,5 л", 1], ["Консерва «Радість туриста»", 2]]);
    expect([f.hp, f.max, f.prot.kin, f.skills.rifles, f.skills.zone]).toEqual([25, 25, 3, 2, 1]);
  });

  it("a weapon whose catalogue entry is gone is found by name; the table line's attachments are added", () => {
    const f = makeFoe(pacan(), DEFAULT_CATALOG, 1, dice(1, 10, 5, 5, 5, 5));
    const akm = f.weapons.find(w => w.slot === "main")!;
    expect([akm.name, akm.cal, akm.mag]).toEqual(["АКМ 74/2 У", "5.45×39", 30]);
    expect(akm.mods.map(m => m.kind)).toEqual(["silencer"]);
  });

  it("re-rolling keeps the loot things; a swapped weapon brings rounds for its new calibre", () => {
    const e = pacan(), f = makeFoe(e, DEFAULT_CATALOG, 1, dice(1, 1, 1, 1, 1, 1));
    f.items.find(i => i.name.startsWith("Консерва"))!.qty = 1;
    rollGear(f, e, DEFAULT_CATALOG, dice(1, 9, 2, 2, 2, 2));
    expect(f.weapons.map(w => w.name)).toEqual(["Макаров (ПМм)", "MP-5"]);
    expect(f.items.find(i => i.name.startsWith("Консерва"))!.qty).toBe(1);
    expect(f.items.filter(i => i.ammo).map(i => i.cal).sort()).toEqual(["9×18", "9×19"]);
    setFoeWeapon(f, e, DEFAULT_CATALOG, "main", "m2", dice(4));
    expect(f.weapons.map(w => w.name)).toEqual(["Макаров (ПМм)", "Мисливська рушниця"]);
    expect(f.items.find(i => i.cal === "12×70 дріб")?.qty).toBe(24);
  });

  it("reloads from its own rounds and shoots with its own skill", () => {
    const f = makeFoe(pacan(), DEFAULT_CATALOG, 1, dice(1, 9, 1, 1, 1, 1));
    const mp5 = f.weapons.find(w => w.name === "MP-5")!;
    mp5.cur = 10;
    expect(foeReload(f, mp5.id)).toBe("Заряджено 20, у запасі лишилось 11.");
    expect(foeReload(f, mp5.id)).toBe("Магазин повний.");
    // no reserve of a calibre: the magazine stays empty, nothing comes for free
    const pm = f.weapons.find(w => w.name === "Макаров (ПМм)")!;
    f.items = f.items.filter(i => i.cal !== "9×18"); pm.cur = 0;
    expect([foeReload(f, pm.id), pm.cur]).toEqual(["Запасних набоїв немає.", 0]);
    const o = resolveShot(f, { ...SHOT0, weapon: mp5.id });
    // Гвинтівки 2 and MP-5 is NATO, +1
    expect(shotCalc({ ...f, mask: false }, { checkPen: 0 }, o).need).toBe(6);
  });

  it("damage goes through its protection and stops at 0", () => {
    const f = makeFoe(pacan(), DEFAULT_CATALOG, 1, dice(1));
    expect(foeDamage(f, 10, "kin")).toEqual({ real: 7, absorbed: 3 });
    expect(foeDamage(f, 10, "elec")).toEqual({ real: 10, absorbed: 0 });
    foeDamage(f, 50, "none");
    expect(f.hp).toBe(0);
  });

  it("a mutant's Без зброї is its Тілобудова and its Атлетика its Реакція", () => {
    const m = newNpc("mutant");
    Object.assign(m.attrs, { til: 7, rea: 3 });
    m.skills = { unarmed: 1, stealth: 2 };
    expect(npcSkills(m)).toMatchObject({ unarmed: 7, athletics: 3, stealth: 2 });
  });
});

describe("encounters and initiative", () => {
  const rea = (id: string) => ({ simka: 3, doc: 2 } as Record<string, number>)[id] ?? 0;

  it("numbers foes of one statblock, adds players once, sorts by initiative with Реакція breaking ties", () => {
    const enc = newEncounter("Засідка");
    addFoes(enc, pacan(), DEFAULT_CATALOG, 2, dice(1));
    addFoes(enc, pacan(), DEFAULT_CATALOG, 1, dice(1));
    expect(enc.foes.map(f => f.name)).toEqual(["Бандит (Пацан) 1", "Бандит (Пацан) 2", "Бандит (Пацан) 3"]);
    expect(addPcs(enc, ["simka", "doc"])).toBe(2);
    expect(addPcs(enc, ["simka"])).toBe(0);
    const [b1, b2, b3] = enc.foes, [s, d] = enc.pcs;
    b1.init = 9; b2.init = 12; s.init = 9; d.init = 14; // b3 has no number yet
    sortInitiative(enc, rea);
    // a tie at 9: the bandit's Реакція 4 beats Сімка's 3
    expect(enc.order).toEqual([d.id, b2.id, b1.id, s.id, b3.id]);
  });

  it("turns skip foes out of the fight and wrap into the next round", () => {
    const enc = newEncounter("Бій");
    addFoes(enc, pacan(), DEFAULT_CATALOG, 2, dice(1));
    addPcs(enc, ["simka"]);
    const [b1, b2] = enc.foes, s = enc.pcs[0];
    b1.init = 15; s.init = 10; b2.init = 5;
    startFight(enc, rea);
    expect([enc.round, enc.turn]).toEqual([1, b1.id]);
    nextTurn(enc, rea); expect(enc.turn).toBe(s.id);
    b2.out = "dead";
    nextTurn(enc, rea); expect([enc.round, enc.turn]).toEqual([2, b1.id]);
    removeCombatant(enc, b1.id, rea);
    // the one acting leaves: the turn passes on within the round
    expect([enc.round, enc.turn, enc.order]).toEqual([2, s.id, [s.id, b2.id]]);
    endFight(enc);
    expect([enc.round, enc.turn]).toEqual([0, ""]);
  });

  it("a stored encounter and compendium read back the same; broken input gets safe values", () => {
    const enc = newEncounter("Склад", "e1");
    addFoes(enc, pacan(), DEFAULT_CATALOG, 1, dice(2));
    addPcs(enc, ["simka"]);
    const back = readEncounter("e1", JSON.parse(JSON.stringify(enc)));
    expect(back).toEqual(enc);
    expect(combatants(back, rea).map(c => c.kind)).toEqual(["foe", "pc"]);
    expect(readNpcs({ list: [JSON.parse(JSON.stringify(pacan()))] })).toEqual([pacan()]);
    const junk = readEncounter("x", { foes: [{ hp: "a", out: "maybe", weapons: [{ slot: "back" }] }], order: [1, "a"] });
    expect(junk.foes[0]).toMatchObject({ hp: 0, out: "", init: null });
    expect(junk.foes[0].weapons[0].slot).toBe("");
    expect(junk.order).toEqual(["a"]);
    expect(readNpcs(null)).toEqual([]);
  });
});
