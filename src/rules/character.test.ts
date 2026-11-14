import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG } from "./catalog";
import { GUNS, MARKET, modPreset } from "./data";
import { SHOT0, migrateCart, addArmor, addGun, newMod, addMarketItem, quickDraw, blankCharacter, cartTotals, dawnLuck, derive, finishDraft, maxHp, migrate, newArmor, newDraft, rangedWeapons, reload, resolveShot, setHp, setLuckPool, shotCalc, skillCost, skillLeft, spendLuck, takeDamage, useItem, wear, weaponModes, weightParts, worn } from "./character";
import { decode, encode } from "./codes";
import type { Character } from "./types";

/** The sniper this sheet was first built for: Спритність 5, Тілобудова 3, Сприйняття 4, Реакція 3, Мудрість 1. */
function simka(): Character {
  const c = blankCharacter();
  Object.assign(c.attrs, { spr: 5, til: 3, spy: 4, rea: 3, mud: 1 });
  Object.assign(c.skills, { rifles: 5, survival: 2, stealth: 2, athletics: 1 });
  c.hp = maxHp(c);
  c.reroll = { skill: "rifles", bonus: 2 };
  return c;
}

describe("health and wounds", () => {
  it("health is Тілобудова × 5 + 10", () => expect(maxHp(simka())).toBe(25));

  it("wounds start at a quarter, half and three quarters of health lost", () => {
    const c = simka();
    const at = (hp: number) => { c.hp = hp; return derive(c); };
    expect(at(25).marks).toEqual([18, 12, 6]);
    expect(at(25).deathAt).toBe(-7);
    expect([19, 18, 12, 6, 0].map(hp => at(hp).level)).toEqual([0, 1, 2, 3, 4]);
    expect(at(19).wounds).toBe(0);
    expect(at(18).wounds).toBe(1);
    expect(at(18).checkPen).toBe(-1);
    expect(at(12).wounds).toBe(2);
    expect(at(12).eff.spr).toBe(4);
    expect(at(12).checkPen).toBe(-2);
    expect(at(6).wounds).toBe(3);
    expect(at(6).eff.spr).toBe(3); // 5 halved, rounded up
    expect(at(0).state).toBe("out");
    expect(at(-6).state).toBe("out");
    expect(at(-7).state).toBe("dead");
  });

  it("treated wounds stop hurting until the next quarter is lost", () => {
    const c = simka();
    setHp(c, 18); c.woundsTreated = true;
    expect(derive(c).checkPen).toBe(0);
    setHp(c, 15);
    expect(c.woundsTreated).toBe(true);
    setHp(c, 12);
    expect(c.woundsTreated).toBe(false);
  });

  it("armour takes its share of damage", () => {
    const c = simka();
    expect(takeDamage(c, 9, "kin")).toEqual({ real: 7, absorbed: 2 });
    expect(c.hp).toBe(18);
    expect(takeDamage(c, 2, "kin").real).toBe(0);
    expect(takeDamage(c, 3, "none").real).toBe(3);
  });
});

describe("conditions", () => {
  it("radiation stages lower attributes", () => {
    const c = simka();
    c.rad = 99; expect(derive(c).radStage).toBe(0);
    c.rad = 100; expect(derive(c).eff.til).toBe(2);
    c.rad = 500; expect(derive(c).eff).toMatchObject({ til: 2, spr: 4, rea: 2 });
    c.rad = 800; expect(derive(c).eff).toMatchObject({ til: 1, spr: 3, rea: 2 });
    c.rad = 1000; expect(derive(c).state).toBe("dead");
  });

  it("one bottle of vodka knocks out a character with Мудрість 1", () => {
    const c = simka();
    expect(derive(c).nextVodkaOut).toBe(true);
    c.vodka = 1;
    const d = derive(c);
    expect(d.eff.mud).toBe(0);
    expect(d.vodkaOut).toBe(true);
    expect(d.state).toBe("out");
  });

  it("the load counts weapons too, and says so", () => {
    const c = simka();
    c.weapons.push({ id: "g", name: "СВД", skill: "rifles", dmg: "2к10", mag: 10, cur: 10, modes: "напівавтомат", range: "", w: 4.3, cal: "7.62×54", nato: false, jams: 0, note: "", on: true, mods: [] });
    c.items.push({ id: "a", name: "Бинт", qty: 2, w: 0.1, note: "" });
    expect(weightParts(c)).toEqual({ items: 0.2, weapons: 4.3, armor: 0 });
    c.armors[0].countW = true;
    expect(weightParts(c).armor).toBe(3);
    c.armors.push({ ...newArmor(), w: 8 });
    expect(weightParts(c).armor).toBe(11);
  });

  it("carrying more than Тілобудова × 10 kg halves Спритність", () => {
    const c = simka();
    c.items.push({ id: "a", name: "Вантаж", qty: 31, w: 1, note: "" });
    const d = derive(c);
    expect(d.cap).toBe(30);
    expect(d.over).toBe(1);
    expect(d.eff.spr).toBe(3);
    c.items[0].qty = 46;
    expect(derive(c).over).toBe(2);
  });
});

describe("shooting", () => {
  it("a plain aimed rifle shot needs 4+ and the reroll lifts 70% to 97%", () => {
    const c = simka(), s = shotCalc(c, derive(c), SHOT0);
    expect(s.mod).toBe(5);
    expect(s.need).toBe(4);
    expect(s.chance).toBeCloseTo(0.7);
    expect(s.reroll).toBe(true);
    expect(s.chanceReroll).toBeCloseTo(0.97);
  });

  it("several shots in one action follow the rules: burst −1 after the first, automatic −1 more each time", () => {
    const c = simka(), d = derive(c);
    expect(shotCalc(c, d, { ...SHOT0, mode: "semi" }).shots.map(s => s.need)).toEqual([4, 4]);
    expect(shotCalc(c, d, { ...SHOT0, mode: "burst" }).shots.map(s => s.need)).toEqual([4, 5, 5]);
    expect(shotCalc(c, d, { ...SHOT0, mode: "auto" }).shots.map(s => s.need)).toEqual([4, 5, 6, 7, 8]);
  });

  it("a picked weapon sets the skill, NATO bonus, jams and the fire modes it has", () => {
    const c = simka();
    c.weapons.push({ id: "mp5", name: "MP-5", skill: "rifles", dmg: "к10+1", mag: 30, cur: 30, modes: "напівавтомат, автомат, по 3", range: "", w: 2.5, cal: "9×19", nato: true, jams: 1, note: "", on: true, mods: [] });
    c.weapons.push({ id: "pm", name: "ПМ", skill: "pistols", dmg: "к10", mag: 8, cur: 8, modes: "напівавтомат", range: "", w: 0.5, cal: "9×18", nato: false, jams: 0, note: "", on: true, mods: [] });
    const mp5 = resolveShot(c, { ...SHOT0, weapon: "mp5", mode: "auto" });
    expect(mp5).toMatchObject({ skill: "rifles", nato: true, jam: 1, mode: "auto" });
    expect(resolveShot(c, { ...SHOT0, weapon: "pm", mode: "auto" })).toMatchObject({ skill: "pistols", nato: false, mode: "single" });
    expect(resolveShot(c, { ...SHOT0, weapon: "gone" }).weapon).toBe("");
    expect(weaponModes("напівавтомат, автомат, по 3")).toEqual(["single", "semi", "burst", "auto"]);
    expect(weaponModes("одиночний")).toEqual(["single"]);
    expect(weaponModes("")).toEqual(["single", "semi", "burst", "auto"]);
  });

  it("modifiers add up and the reroll only applies to its weapon", () => {
    const c = simka(), d = derive(c);
    const s = shotCalc(c, d, { ...SHOT0, shot: "quick", optic: true, cover: "3", vis: true });
    expect(s.mod).toBe(5 - 1 + 1 - 3 - 2);
    expect(shotCalc(c, d, { ...SHOT0, skill: "pistols" }).reroll).toBe(false);
  });
});

describe("gear", () => {
  it("ammunition stacks by calibre and reloading draws from it", () => {
    const c = simka();
    const ammo = MARKET.find(m => m.ammo && m.cal === "9×18")!;
    addMarketItem(c, ammo); addMarketItem(c, ammo);
    expect(c.items).toHaveLength(1);
    expect(c.items[0].qty).toBe(200);
    c.weapons.push({ id: "g", name: "ПМ", skill: "pistols", dmg: "к10", mag: 8, cur: 3, modes: "", range: "", w: 0.5, cal: "9x18", nato: false, jams: 0, note: "", on: true, mods: [] });
    expect(reload(c, "g")).toContain("Заряджено 5");
    expect(c.weapons[0].cur).toBe(8);
    expect(c.items[0].qty).toBe(195);
  });

  it("armour-piercing rounds load only once the ordinary ones of that calibre run out", () => {
    const c = simka();
    addMarketItem(c, MARKET.find(m => m.ammo && m.cal === "9×18 БП")!);
    expect(c.items[0].note).toContain("4 кінетичної");
    c.weapons.push({ id: "g", name: "ПМ", skill: "pistols", dmg: "к10", mag: 8, cur: 0, modes: "", range: "", w: 0.5, cal: "9×18", nato: false, jams: 0, note: "", on: true, mods: [] });
    expect(reload(c, "g")).toBe("Заряджено 8 бронебійних, у рюкзаку лишилось 92.");
    addMarketItem(c, MARKET.find(m => m.ammo && m.cal === "9×18")!);
    c.weapons[0].cur = 0;
    expect(reload(c, "g")).toBe("Заряджено 8, у рюкзаку лишилось 92.");
    expect(c.items.map(x => x.qty)).toEqual([92, 92]);
  });

  it("antirad and vodka change radiation", () => {
    const c = simka(); c.rad = 300;
    addMarketItem(c, MARKET.find(m => m.fx === "antirad")!);
    addMarketItem(c, MARKET.find(m => m.fx === "vodka")!);
    useItem(c, c.items[0].id);
    expect(c.rad).toBe(50);
    useItem(c, c.items[1].id);
    expect(c.rad).toBe(0);
    expect(c.vodka).toBe(1);
  });
});

describe("armour and attachments", () => {
  it("an old sheet with one armour and the gas mask on it moves to the new shape", () => {
    const c = migrate({ armor: { name: "Комбінезон", kin: 6, acid: 3, fire: 3, elec: 3, rad: 10, w: 8, countW: true, slots: 2, mask: true }, weapons: [{ name: "СВД", skill: "rifles" }] });
    expect(c.armors).toHaveLength(1);
    expect(c.armors[0]).toMatchObject({ name: "Комбінезон", kin: 6, on: true });
    expect("mask" in c.armors[0]).toBe(false);
    expect(c.mask).toBe(true);
    expect("armor" in c).toBe(false);
    expect(c.weapons[0]).toMatchObject({ on: true, mods: [] });
  });

  it("only the worn armour stops damage, and wearing one takes the other off", () => {
    const c = simka();
    const suit = { ...newArmor(), name: "Комбінезон", kin: 6 };
    c.armors.push(suit);
    expect(worn(c)?.name).toBe("Шкіряна куртка");
    wear(c, suit.id);
    expect(worn(c)?.name).toBe("Комбінезон");
    expect(c.armors.filter(a => a.on)).toHaveLength(1);
    expect(takeDamage(c, 9, "kin").real).toBe(3);
    wear(c, suit.id);
    expect(worn(c)).toBeUndefined();
    expect(takeDamage(c, 4, "kin").real).toBe(4);
  });

  it("the calculator offers a scope only for a weapon that has one, and counts the GM's bonus of other attachments", () => {
    const c = simka(), d = derive(c);
    c.weapons.push({ id: "svd", name: "СВД", skill: "rifles", dmg: "2к10", mag: 10, cur: 10, modes: "напівавтомат", range: "", w: 4.3, cal: "7.62×54", nato: false, jams: 0, note: "", on: true,
      mods: [{ id: "sc", name: "Оптичний приціл", kind: "optic", bonus: 1 }, { id: "bp", name: "Сошки", kind: "other", bonus: 1 }] });
    c.weapons.push({ id: "pm", name: "ПМ", skill: "pistols", dmg: "к10", mag: 8, cur: 8, modes: "напівавтомат", range: "", w: 0.5, cal: "9×18", nato: false, jams: 0, note: "", on: true, mods: [] });
    c.weapons.push({ id: "spare", name: "Запасна", skill: "rifles", dmg: "", mag: 10, cur: 10, modes: "", range: "", w: 3, cal: "", nato: false, jams: 0, note: "", on: false, mods: [] });
    expect(rangedWeapons(c).map(g => g.id)).toEqual(["svd", "pm"]);
    const svd = resolveShot(c, { ...SHOT0, weapon: "svd", optic: true, mods: ["bp"] });
    expect(svd.optic).toBe(true);
    expect(shotCalc(c, d, svd).mod).toBe(5 + 1 + 1);
    expect(resolveShot(c, { ...SHOT0, weapon: "pm", optic: true }).optic).toBe(false);
  });
});

describe("the GM's document of 2026-11-14", () => {
  it("the standard catalogue has its armour, and taking one copies the note", () => {
    const c = simka();
    const exo = DEFAULT_CATALOG.armors.find(a => a.n === "Екзоскелет")!;
    expect(exo).toMatchObject({ id: "a-11", kin: 15, w: 15, slots: 2, p: 100000 });
    addArmor(c, exo);
    expect(c.armors[1]).toMatchObject({ name: "Екзоскелет", note: "Без Ривка, Спритність −1.", on: false, countW: true });
  });

  it("a bipod takes away the penalty for shooting prone", () => {
    const c = simka(), d = derive(c);
    c.weapons.push({ id: "svd", name: "СВД", skill: "rifles", dmg: "2к10", mag: 10, cur: 10, modes: "одиночний", range: "", w: 5, cal: "7.62×54", nato: false, jams: 0, note: "", on: true, mods: [] });
    const lying = () => shotCalc(c, d, resolveShot(c, { ...SHOT0, weapon: "svd", lying: true })).mod;
    expect(lying()).toBe(5 - 2);
    c.weapons[0].mods.push(newMod(modPreset("bipod")));
    expect(lying()).toBe(5);
  });
});

describe("weapon features from the GM's earlier document", () => {
  it("catalogue weapons arrive with their features; a laser counts outside automatic fire; the АН-94 bursts without −1", () => {
    const c = simka(), d = derive(c);
    addGun(c, GUNS.find(g => g.n.startsWith("АН-94"))!);
    addGun(c, GUNS.find(g => g.n.startsWith("Драгунов"))!);
    const an = c.weapons[0], svd = c.weapons[1];
    expect(an.mods.map(m => m.kind)).toEqual(["burst0"]);
    expect(svd.mods.map(m => m.kind)).toEqual(["heavy", "bulky", "optic"]);
    expect(svd.range).toBe("Екстремальна");
    expect(shotCalc(c, d, resolveShot(c, { ...SHOT0, weapon: an.id, mode: "burst" })).shots.map(s => s.need)).toEqual([4, 4, 4]);
    an.mods.push({ id: "lz", name: "Лазерний цілевказівник", kind: "laser", bonus: 1 });
    expect(shotCalc(c, d, resolveShot(c, { ...SHOT0, weapon: an.id, mode: "single", mods: ["lz"] })).mod).toBe(6);
    expect(shotCalc(c, d, resolveShot(c, { ...SHOT0, weapon: an.id, mode: "auto", mods: ["lz"] })).mod).toBe(5);
  });

  it("quick draw: bulky makes it harder, an ergonomic grip easier", () => {
    const c = simka(), d = derive(c);
    addGun(c, GUNS.find(g => g.n.startsWith("Драгунов"))!);
    addGun(c, GUNS.find(g => g.n === "Фора-12м")!);
    expect(quickDraw(c, d, c.weapons[0])).toBeCloseTo(0.8); // (5 + 5 − 2) / 10
    expect(quickDraw(c, d, c.weapons[1])).toBeCloseTo(0.7); // (0 + 5 + 2) / 10
  });

  it("weapons saved before ranges existed get an empty one", () => {
    expect(migrate({ weapons: [{ name: "СВД", skill: "rifles" }] }).weapons[0].range).toBe("");
  });
});

describe("luck", () => {
  it("costs 1, 3 or 5 and refuses when there is not enough", () => {
    const c = simka();
    setLuckPool(c, 8); c.luck.cur = 8;
    expect(spendLuck(c, "auto")).toBe(true);
    expect(c.luck.cur).toBe(3);
    expect(spendLuck(c, "reroll")).toBe(true);
    expect(c.luck.cur).toBe(0);
    expect(spendLuck(c, "bonus")).toBe(false);
    expect(c.luck.cur).toBe(0);
  });

  it("comes back at dawn, more in a safe zone, never above the pool", () => {
    const c = simka();
    setLuckPool(c, 7); c.luck.cur = 1;
    expect(dawnLuck(c, false)).toBe(2);
    expect(c.luck.cur).toBe(3);
    expect(dawnLuck(c, true)).toBe(3);
    expect(c.luck.cur).toBe(6);
    expect(dawnLuck(c, true)).toBe(1);
    expect(c.luck.cur).toBe(7);
  });

  it("a smaller pool cuts what is left; sheets saved before luck existed get an empty pool", () => {
    const c = simka();
    setLuckPool(c, 8); c.luck.cur = 8;
    setLuckPool(c, 6);
    expect(c.luck).toEqual({ pool: 6, cur: 6 });
    expect(migrate({ attrs: { spr: 5 } }).luck).toEqual({ pool: 0, cur: 0 });
  });

  it("a new character starts with the whole pool, or 0 when the player left it empty", () => {
    const w = newDraft();
    w.d.luck.pool = 7;
    expect(finishDraft(w).luck).toEqual({ pool: 7, cur: 7 });
    expect(finishDraft(newDraft()).luck).toEqual({ pool: 0, cur: 0 });
  });
});

describe("creation", () => {
  it("skill levels cost their own number", () => {
    expect([1, 2, 3, 4, 5].map(skillCost)).toEqual([1, 3, 6, 10, 15]);
    const c = simka();
    c.skills.survival = 1; c.skills.stealth = 1;
    expect(skillLeft(c)).toBe(0);
  });

  it("finishing a draft buys the basket and banks what is left", () => {
    const w = newDraft();
    w.d.id.callsign = "Тест";
    Object.assign(w.d.attrs, { spr: 4, til: 3, spy: 4, rea: 3, mud: 1 }); // 15 of 16
    w.d.skills.rifles = 5;
    w.cart.m["m-0"] = 2; // two antirads, 800
    w.cart.g["g-0"] = 1; // Makarov, 500
    w.ab = { name: "Гостре око", text: "Перекид" };
    expect(cartTotals(w).cost).toBe(1300);
    const c = finishDraft(w);
    expect(c.money).toBe(2700);
    expect(c.freeAttr).toBe(1);
    expect(c.freeSkill).toBe(3);
    expect(c.hp).toBe(25);
    expect(c.items[0].qty).toBe(2);
    expect(c.weapons[0].name).toBe(GUNS[0].n);
    expect(c.abilities[0].name).toBe("Гостре око");
  });

  it("reads a basket saved before the catalogue, and buys from the GM's catalogue by id", () => {
    expect(migrateCart({ m: { "0": 2, "x": 0 }, g: { "3": 1 } })).toEqual({ m: { "m-0": 2 }, g: { "g-3": 1 }, a: {} });
    const cat = { ...DEFAULT_CATALOG, armors: [{ id: "vest", n: "Бронежилет", kin: 4, acid: 0, fire: 1, elec: 0, rad: 0, w: 6, slots: 0, p: 900 }] };
    const w = newDraft();
    w.cart.a.vest = 1;
    w.cart.m.gone = 3; // an entry the GM has since deleted counts for nothing
    expect(cartTotals(w, cat)).toEqual({ cost: 900, weight: 6 });
    const c = finishDraft(w, cat);
    expect(c.armors.find(a => a.name === "Бронежилет")).toMatchObject({ kin: 4, fire: 1, on: false, countW: true });
  });
});

describe("stored sheets", () => {
  it("migrate fills gaps and drops private notes", () => {
    const c = migrate({ id: { callsign: "Сімка" }, attrs: { spr: 5 }, secret: "таємниця", items: [{ name: "Бинт", qty: 1, w: 0.1 }] });
    expect(c.id.callsign).toBe("Сімка");
    expect(c.id.role).toBe("");
    expect(c.attrs).toMatchObject({ spr: 5, til: 1 });
    expect(c.items[0].id).toBeTruthy();
    expect("secret" in c).toBe(false);
    expect(migrate(null).attrs.spr).toBe(1);
  });

  it("a backup code survives the round trip", async () => {
    const c = simka(); c.id.callsign = "Сімка";
    const code = await encode(c);
    expect(code.startsWith("Z1.")).toBe(true);
    expect(await decode("посилання https://x/#c=" + code)).toEqual(c);
    await expect(decode("не код")).rejects.toThrow("fmt");
  });
});
