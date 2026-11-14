import { describe, expect, it } from "vitest";
import { GUNS, MARKET } from "./data";
import { SHOT0, addMarketItem, blankCharacter, cartTotals, dawnLuck, derive, finishDraft, maxHp, migrate, newDraft, reload, setHp, setLuckPool, shotCalc, skillCost, skillLeft, spendLuck, takeDamage, useItem } from "./character";
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
    c.weapons.push({ id: "g", name: "ПМ", skill: "pistols", dmg: "к10", mag: 8, cur: 3, modes: "", w: 0.5, cal: "9x18", nato: false, jams: 0, note: "" });
    expect(reload(c, "g")).toContain("Заряджено 5");
    expect(c.weapons[0].cur).toBe(8);
    expect(c.items[0].qty).toBe(195);
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
    w.cart.m[0] = 2; // two antirads, 800
    w.cart.g[0] = 1; // Makarov, 500
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
