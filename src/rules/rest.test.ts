import { describe, expect, it } from "vitest";
import { MARKET } from "./data";
import { addMarketItem, blankCharacter, maxHp, setLuckPool } from "./character";
import { REST0, applyRest, planRest } from "./rest";

const buy = (c: ReturnType<typeof blankCharacter>, name: string, times = 1) => {
  const m = MARKET.find(x => x.n === name)!;
  for (let i = 0; i < times; i++) addMarketItem(c, m);
};
function tired() {
  const c = blankCharacter();
  c.attrs.til = 3; c.hp = 10; c.rad = 40; c.vodka = 2; c.noSleep = 1;
  setLuckPool(c, 8); c.luck.cur = 3;
  buy(c, "Сніданок туриста"); buy(c, "Вода, 1 л");
  return c;
}

describe("rest", () => {
  it("a night: health, radiation, sleep, alcohol, luck, and a meal and water from the backpack", () => {
    const c = tired();
    const r = applyRest(c, REST0);
    expect(r.hp).toEqual([10, 14]);
    expect(r.rad).toEqual([40, 24]);
    expect(r.luck).toEqual([3, 5]);
    expect(r.vodka).toEqual([2, 0]);
    expect(r.slept).toBe(true);
    expect(c.noSleep).toBe(0);
    expect(r.eaten).toEqual(["Сніданок туриста"]);
    expect(r.drunk).toEqual(["Вода, 1 л"]);
    expect(c.items.map(i => i.qty)).toEqual([0, 0]);
    expect(r.warnings).toEqual([]);
  });

  it("care heals faster, danger slower, a safe day gives one more luck, nothing goes above the maximum", () => {
    expect(planRest(tired(), { ...REST0, care: "care" }).hp[1]).toBe(18);
    expect(planRest(tired(), { ...REST0, care: "danger" }).hp[1]).toBe(12);
    expect(planRest(tired(), { ...REST0, safe12: true }).luck[1]).toBe(6);
    const full = tired(); full.hp = maxHp(full) - 1;
    expect(planRest(full, { ...REST0, care: "care" }).hp[1]).toBe(maxHp(full));
  });

  it("an empty backpack: a hungry, thirsty day and no healing", () => {
    const c = tired(); c.items = [];
    const r = applyRest(c, REST0);
    expect(r.hungry && r.thirsty).toBe(true);
    expect(r.hp).toEqual([10, 10]);
    expect(c.noFood).toBe(1);
    expect(c.noWater).toBe(1);
    expect(r.warnings).toContain("Без їжі й води здоров'я не відновлюється.");
  });

  it("food from elsewhere counts as eaten without touching the backpack; two halves make a ration", () => {
    const c = tired(); c.items = []; buy(c, "Хліб", 2); buy(c, "Вода, 1 л");
    const r = applyRest(c, { ...REST0, food: "pack" });
    expect(r.eaten).toEqual(["Хліб", "Хліб"]);
    const d = tired(); d.items = [];
    expect(applyRest(d, { ...REST0, food: "other", water: "other" }).hungry).toBe(false);
    expect(d.noFood).toBe(0);
  });

  it("a short rest before dawn: no meal, no luck, no sleep", () => {
    const c = tired();
    const r = applyRest(c, { ...REST0, hours: 2, dawn: false });
    expect(r.hp).toEqual([10, 11]);
    expect(r.luck).toEqual([3, 3]);
    expect(r.slept).toBe(false);
    expect(c.items.map(i => i.qty)).toEqual([1, 1]);
  });

  it("planning changes nothing", () => {
    const c = tired();
    const snapshot = JSON.stringify(c);
    planRest(c, REST0);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});
