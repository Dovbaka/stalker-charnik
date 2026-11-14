// The GM's rules as data. Source: the rules document of the campaign.
import type { AttrKey, ItemEffect, SkillKey } from "./types";

export const ATTR_PTS = 16;
export const SKILL_PTS = 18;
export const START_MONEY = 4000;

export const ATTRS: { key: AttrKey; name: string; abbr: string; long: string }[] = [
  { key: "spr", name: "Спритність", abbr: "Сприт", long: "Швидкість і мобільність: скільки метрів за хід, скритність, ухилення, швидко дістати зброю." },
  { key: "til", name: "Тілобудова", abbr: "Тіло", long: "Витривалість і сила: здоров'я (×5 + 10), удар у ближньому бою, вантаж (×10 кг)." },
  { key: "spy", name: "Сприйняття", abbr: "Сприй", long: "Уважність та інстинкти: помітити ворога, слід чи засідку." },
  { key: "rea", name: "Реакція", abbr: "Реак", long: "Рефлекси: хто ходить першим у бою." },
  { key: "mud", name: "Мудрість", abbr: "Мудр", long: "Інтелект і кмітливість: знання, медицина, складні задачі." },
];
export const ATTR_ABBR = Object.fromEntries(ATTRS.map(a => [a.key, a.abbr])) as Record<AttrKey, string>;
export const ATTR_KEYS: AttrKey[] = ATTRS.map(a => a.key);

export const SKILL_GROUPS: { name: string; skills: { key: SkillKey; name: string; attr?: AttrKey }[] }[] = [
  { name: "Бойові", skills: [{ key: "pistols", name: "Пістолети" }, { key: "rifles", name: "Гвинтівки" }, { key: "heavy", name: "Важка зброя" }, { key: "melee", name: "Зброя ближнього бою", attr: "til" }, { key: "unarmed", name: "Без зброї", attr: "til" }] },
  { name: "Дипломатичні", skills: [{ key: "barter", name: "Бартер" }, { key: "deceit", name: "Обман" }, { key: "persuade", name: "Переконання" }] },
  { name: "Професійні", skills: [{ key: "medicine", name: "Медицина", attr: "mud" }, { key: "repair", name: "Ремонт" }, { key: "scavenge", name: "Збиральництво" }, { key: "science", name: "Наука" }] },
  { name: "Фізичні", skills: [{ key: "athletics", name: "Атлетика", attr: "spr" }, { key: "survival", name: "Виживання", attr: "spy" }, { key: "sleight", name: "Спритність рук", attr: "spr" }, { key: "stealth", name: "Скритність", attr: "spr" }] },
];
export const SKILL_KEYS: SkillKey[] = SKILL_GROUPS.flatMap(g => g.skills.map(s => s.key));
export const SKILL_NAME = Object.fromEntries(SKILL_GROUPS.flatMap(g => g.skills.map(s => [s.key, s.name]))) as Record<SkillKey, string>;

export const RAD_STAGE = ["Безсимптомна", "Початкова", "Середня", "Важка", "Критична", "Фатальна"];
export const RAD_FX = ["без ефекту", "−1 Тілобудова", "−1 Тілобудова, −1 Спритність", "−1 Тілобудова, −1 Спритність, −1 Реакція", "−2 Тілобудова, −2 Спритність, −1 Реакція", "смерть"];
/** penalties per stage: Тілобудова, Спритність, Реакція */
export const RAD_PEN: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 2, 1], [0, 0, 0]];

export interface MarketEntry {
  g: string;
  n?: string;
  w?: number;
  p: number;
  d?: string;
  uses?: number;
  fx?: ItemEffect;
  ammo?: boolean;
  cal?: string;
  pack?: number;
}
export const MARKET: MarketEntry[] = [
  { g: "Медицина", n: "Антирад", w: 0.1, p: 400, fx: "antirad", d: "виводить 250 рад" },
  { g: "Медицина", n: "Бинт", w: 0.1, p: 40, d: "+2 до Медицини проти кровотечі" },
  { g: "Медицина", n: "Аптечка", w: 0.5, p: 300, uses: 3, d: "+4 до лікування ран, 3 використання" },
  { g: "Медицина", n: "Армійська аптечка", w: 0.5, p: 600, uses: 3, d: "+8 до лікування ран, 3 використання" },
  { g: "Медицина", n: "Наукова аптечка", w: 0.5, p: 800, uses: 3, fx: "sci", d: "+8 до лікування, виводить 250 рад, 3 використання" },
  { g: "Медицина", n: "Горілка «Козаки»", w: 0.5, p: 200, fx: "vodka", d: "виводить 100 рад, −1 до чотирьох характеристик" },
  { g: "Їжа й вода", n: "Вода, 1 л", w: 1, p: 50, d: "денна норма" },
  { g: "Їжа й вода", n: "Хліб", w: 0.5, p: 40, d: "пів раціону" },
  { g: "Їжа й вода", n: "Ковбаса", w: 0.3, p: 40, d: "пів раціону" },
  { g: "Їжа й вода", n: "Сніданок туриста", w: 0.5, p: 100, d: "повний раціон" },
  { g: "Їжа й вода", n: "MRE", w: 1, p: 500, uses: 5, d: "повний раціон, 5 порцій" },
  { g: "Спорядження", n: "Спальник", w: 1, p: 200, d: "" },
  { g: "Спорядження", n: "Протигаз", w: 0.5, p: 500, d: "фільтр міняти кожні 2 години" },
  { g: "Спорядження", n: "Фільтр до протигаза", w: 0, p: 50, d: "на 2 години" },
  { g: "Набої, 1 кг", ammo: true, cal: "7.62×54", pack: 50, p: 800 },
  { g: "Набої, 1 кг", ammo: true, cal: "7.62×51 НАТО", pack: 50, p: 800 },
  { g: "Набої, 1 кг", ammo: true, cal: "5.45×39", pack: 60, p: 800 },
  { g: "Набої, 1 кг", ammo: true, cal: "5.56×45", pack: 60, p: 800 },
  { g: "Набої, 1 кг", ammo: true, cal: "9×39", pack: 60, p: 800 },
  { g: "Набої, 1 кг", ammo: true, cal: "9×18", pack: 100, p: 500 },
  { g: "Набої, 1 кг", ammo: true, cal: "9×19", pack: 100, p: 500 },
  { g: "Набої, 1 кг", ammo: true, cal: "12×70 дріб", pack: 30, p: 200 },
];
export const marketName = (m: MarketEntry) => (m.ammo ? `Набої ${m.cal}, ${m.pack} шт` : m.n ?? "");

export interface GunEntry {
  n: string;
  skill: SkillKey;
  mag: number;
  dmg: string;
  modes: string;
  w: number;
  cal: string;
  p: number;
  nato?: boolean;
  note: string;
}
export const GUNS: GunEntry[] = [
  { n: "Макаров (ПМм)", skill: "pistols", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 500, note: "Коротка дистанція. Кожна 1 на к10 рахується за дві." },
  { n: "Стєчкін (АПС)", skill: "pistols", mag: 20, dmg: "к10", modes: "напівавтомат, автомат", w: 1.5, cal: "9×18", p: 1500, note: "Коротка дистанція." },
  { n: "Фора-12м", skill: "pistols", mag: 12, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1500, note: "Коротка дистанція. Ергономічна рукоятка." },
  { n: "ПБ-1с", skill: "pistols", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1000, note: "Коротка дистанція. Вбудований глушник." },
  { n: "Walker P99", skill: "pistols", mag: 16, dmg: "к10+1", modes: "напівавтомат", w: 0.5, cal: "9×19", p: 2000, nato: true, note: "Коротка дистанція. Ергономічна рукоятка." },
  { n: "MP-5", skill: "rifles", mag: 30, dmg: "к10+1", modes: "напівавтомат, автомат, по 3", w: 2.5, cal: "9×19", p: 2500, nato: true, note: "Коротка дистанція. Навичку уточни в майстра." },
  { n: "Обріз", skill: "rifles", mag: 2, dmg: "3к10", modes: "одиночний", w: 2, cal: "12×70 дріб", p: 2000, note: "Близька дистанція. Ігнорує 5 кінетичної броні зблизька і 3 на короткій. Навичку уточни в майстра." },
  { n: "Ніж", skill: "melee", mag: 0, dmg: "", modes: "", w: 0.5, cal: "", p: 1000, note: "На 10 при поцілюванні: +3 шкоди, і вся шкода повз кінетичну броню." },
  { n: "Кастети", skill: "unarmed", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 500, note: "" },
  { n: "Шиповані кастети", skill: "unarmed", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 800, note: "Може викликати кровотечу." },
];
/** what "Своя зброя" starts from */
export const CUSTOM_GUN: GunEntry = { n: "Нова зброя", skill: "rifles", mag: 10, dmg: "", modes: "", w: 4, cal: "7.62×54", p: 0, note: "" };

export const WEAPON_SKILLS: SkillKey[] = ["rifles", "pistols", "heavy", "melee", "unarmed"];
export const REROLL_OPTIONS: [string, string][] = [["", "немає"], ["rifles", "гвинтівки"], ["pistols", "пістолети"], ["heavy", "важка зброя"], ["any", "будь-яка зброя"]];
