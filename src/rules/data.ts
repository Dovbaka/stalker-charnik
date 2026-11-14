// The GM's rules as data. Source: the rules document of the campaign.
import type { ArtFx, ArtFxKey, ArtRarity, ArtType, AttrKey, ItemEffect, ModKind, SkillKey } from "./types";

export const ATTR_PTS = 16;
export const SKILL_PTS = 18;
export const START_MONEY = 4000;

export const ATTRS: { key: AttrKey; name: string; long: string }[] = [
  { key: "spr", name: "Спритність", long: "Швидкість і мобільність: скільки метрів за хід, скритність, ухилення, швидко дістати зброю." },
  { key: "til", name: "Тілобудова", long: "Витривалість і сила: здоров'я (×5 + 10), удар у ближньому бою, вантаж (×10 кг)." },
  { key: "spy", name: "Сприйняття", long: "Уважність та інстинкти: помітити ворога, слід чи засідку." },
  { key: "rea", name: "Реакція", long: "Рефлекси: хто ходить першим у бою." },
  { key: "mud", name: "Мудрість", long: "Інтелект і кмітливість: знання, медицина, складні задачі." },
];
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
const AP = "бронебійні: ігнорують 4 кінетичної броні";
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
  { g: "Набої, 1 кг", ammo: true, cal: "7.62×25", pack: 100, p: 500 },
  { g: "Набої, 1 кг", ammo: true, cal: ".45 ACP", pack: 80, p: 1000 },
  { g: "Набої, 1 кг", ammo: true, cal: ".44 Magnum", pack: 80, p: 1000 },
  { g: "Набої, 1 кг", ammo: true, cal: "12.7×108", pack: 20, p: 1000 },
  { g: "Вибухівка", n: "РГД-5", w: 0.5, p: 0, d: "кидок, радіус 5 м, 3к10" },
  { g: "Вибухівка", n: "Ф1 «Лимонка»", w: 0.5, p: 0, d: "кидок, радіус 10 м, 3к10+1" },
  { g: "Вибухівка", n: "30мм снаряд", w: 0.1, p: 0, d: "постріл, радіус 3 м, 3к10" },
  { g: "Вибухівка", n: "40мм снаряд", w: 0.2, p: 0, d: "постріл, радіус 5 м, 3к10+1" },
  { g: "Вибухівка", n: "Заряд РПГ", w: 2, p: 0, d: "постріл, радіус 10 м, 3к10+1" },
  { g: "Вибухівка", n: "Запалювальний заряд РПГ", w: 2, p: 0, d: "постріл, радіус 3 м, 4к10" },
  // added from the GM's document of 2026-11-14; ids m-N are positions, so new entries go at the end
  { g: "Медицина", n: "Енергетик NONSTOP", w: 0.5, p: 1000, d: "к3 раундів «Рух» як вільна дія, потім стільки ж раундів −2 Спритності" },
  { g: "Спорядження", n: "Камуфляж", w: 0, p: 0, d: "+5 до Скритності, вдягається поверх комбінезона" },
  // armour-piercing rounds: three times the price, ignore 4 kinetic armour
  { g: "Набої, 1 кг", ammo: true, cal: "7.62×54 БП", pack: 50, p: 2400, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "7.62×51 НАТО БП", pack: 50, p: 2400, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "5.45×39 БП", pack: 60, p: 2400, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "5.56×45 БП", pack: 60, p: 2400, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "9×39 БП", pack: 60, p: 2400, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "9×18 БП", pack: 100, p: 1500, d: AP },
  { g: "Набої, 1 кг", ammo: true, cal: "9×19 БП", pack: 100, p: 1500, d: AP },
];
export const marketName = (m: MarketEntry) => (m.ammo ? `Набої ${m.cal}, ${m.pack} шт` : m.n ?? "");

export interface GunEntry {
  n: string;
  /** catalogue group: Пістолети, Гвинтівки, Дробовики, Важка зброя, Холодна зброя */
  g: string;
  skill: SkillKey;
  /** Близька, Коротка, Середня, Далека, Екстремальна */
  range: string;
  mag: number;
  dmg: string;
  modes: string;
  w: number;
  cal: string;
  /** price in coupons; 0 when no rules document names one */
  p: number;
  nato?: boolean;
  note: string;
  /** attachments and features it comes with */
  mods?: ModKind[];
}

// Current rules document first, in its order (catalogue ids g-N are positions in this list, so append, never reorder),
// then the GM's earlier document. Prices, NATO flags and the Desert Eagle's weight follow the GM's tables of 2026-11-14:
// red is Warsaw Pact, blue is NATO, black is neither. Those tables write the TT's round as 7.62x22, a slip for 7.62×25.
const SHOT = "Дробовик ігнорує 5 кінетичної броні зблизька і 3 на короткій.";
export const GUNS: GunEntry[] = [
  { n: "Макаров (ПМм)", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 500, note: "", mods: ["fragile"] },
  { n: "Стєчкін (АПС)", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 20, dmg: "к10", modes: "напівавтомат, автомат", w: 1.5, cal: "9×18", p: 1500, note: "" },
  { n: "Фора-12м", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 12, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1500, note: "", mods: ["grip"] },
  { n: "ПБ-1с", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1000, note: "", mods: ["silencer"] },
  { n: "Walker P99", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 16, dmg: "к10+1", modes: "напівавтомат", w: 0.5, cal: "9×19", p: 2000, nato: true, note: "", mods: ["grip"] },
  { n: "MP-5", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 30, dmg: "к10+1", modes: "напівавтомат, автомат, по 3", w: 2.5, cal: "9×19", p: 3000, nato: true, note: "" },
  { n: "Обріз", g: "Дробовики", skill: "rifles", range: "Близька", mag: 2, dmg: "3к10", modes: "одиночний", w: 2, cal: "12×70 дріб", p: 2000, note: SHOT },
  { n: "Ніж", g: "Холодна зброя", skill: "melee", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 1000, note: "На 10 при поцілюванні: +3 шкоди, і вся шкода повз кінетичну броню." },
  { n: "Кастети", g: "Холодна зброя", skill: "unarmed", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 500, note: "" },
  { n: "Шиповані кастети", g: "Холодна зброя", skill: "unarmed", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 800, note: "Може викликати кровотечу." },
  // the GM's earlier document
  { n: "Токарєв (ТТ)", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 8, dmg: "к10", modes: "напівавтомат", w: 1, cal: "7.62×25", p: 1250, note: "" },
  { n: "M1911", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 7, dmg: "к10+2", modes: "напівавтомат", w: 1, cal: ".45 ACP", p: 2000, nato: true, note: "" },
  { n: "Desert Eagle", g: "Пістолети", skill: "pistols", range: "Коротка", mag: 8, dmg: "к10+3", modes: "напівавтомат", w: 2, cal: ".44 Magnum", p: 3000, nato: true, note: "", mods: ["heavy", "bulky"] },
  { n: "ПКШ-41", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 70, dmg: "к10", modes: "автомат", w: 3.5, cal: "7.62×25", p: 3000, note: "" },
  { n: "АКМ 74/2 У", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат", w: 3, cal: "5.45×39", p: 4000, note: "Швидке вихоплювання: −2 до кидка." },
  { n: "АКМ 74/2", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат", w: 3.5, cal: "5.45×39", p: 5500, note: "" },
  { n: "АН-94 «Абакан»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат, по 3", w: 4, cal: "5.45×39", p: 6500, note: "", mods: ["burst0"] },
  { n: "Enfield L85A1", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 30, dmg: "2к10+1", modes: "напівавтомат, автомат", w: 5, cal: "5.56×45", p: 6000, nato: true, note: "", mods: ["optic"] },
  { n: "ZM Light Rifle 300", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10+1", modes: "напівавтомат, автомат", w: 3, cal: "5.56×45", p: 7000, nato: true, note: "" },
  { n: "Sturmgewehr 550", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10+3", modes: "напівавтомат, автомат", w: 4, cal: "5.56×45", p: 9000, nato: true, note: "", mods: ["reliable"] },
  { n: "АС «Вал»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 20, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 2.5, cal: "9×39", p: 8000, note: "Швидке вихоплювання: −2 до кидка.", mods: ["silencer"] },
  { n: "ОЦ-14 «Гроза»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 20, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 3, cal: "9×39", p: 8000, note: "Гранатомет під 40-мм гранати Варшавського договору.", mods: ["gl40"] },
  { n: "ВСС «Вінторєз»", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 10, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 3, cal: "9×39", p: 9000, note: "", mods: ["optic", "silencer"] },
  { n: "М91/30 «Мосіна»", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 5, dmg: "2к10+3", modes: "одиночний", w: 4, cal: "7.62×54", p: 5000, note: "", mods: ["bulky"] },
  { n: "Galil", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 25, dmg: "2к10+3", modes: "напівавтомат, автомат", w: 4, cal: "7.62×54", p: 6000, nato: true, note: "" },
  { n: "FN FAL", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 30, dmg: "2к10+3", modes: "напівавтомат, автомат", w: 4, cal: "7.62×51 НАТО", p: 6000, nato: true, note: "" },
  { n: "Драгунов (СВД)", g: "Гвинтівки", skill: "rifles", range: "Екстремальна", mag: 10, dmg: "2к10+3", modes: "одиночний", w: 5, cal: "7.62×54", p: 9000, note: "", mods: ["heavy", "bulky", "optic"] },
  { n: "Гвинтівка Гаусса", g: "Гвинтівки", skill: "rifles", range: "Екстремальна", mag: 10, dmg: "3к10+3", modes: "одиночний", w: 5.5, cal: "2мм Гаусс", p: 0, note: "Ігнорує кінетичну броню цілі.", mods: ["heavy", "bulky", "optic"] },
  { n: "Мисливська рушниця", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 2, dmg: "3к10", modes: "одиночний", w: 2.5, cal: "12×70 дріб", p: 3500, note: SHOT },
  { n: "Mossberg 930", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 6, dmg: "3к10", modes: "одиночний", w: 3, cal: "12×70 дріб", p: 5000, note: SHOT },
  { n: "SPAS-12", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 8, dmg: "2к10", modes: "напівавтомат, автомат", w: 4.5, cal: "12×70 дріб", p: 6500, note: SHOT },
  { n: "ПКМ", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "2к10+3", modes: "автомат", w: 9, cal: "7.62×54", p: 0, note: "Стрічкове живлення.", mods: ["heavy"] },
  { n: "FN Minimi", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "2к10+3", modes: "автомат", w: 7, cal: "7.62×51 НАТО", p: 0, nato: true, note: "Стрічкове живлення.", mods: ["heavy"] },
  { n: "РПГ-7", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 1, dmg: "як снаряд", modes: "одиночний", w: 7, cal: "Заряд РПГ", p: 0, note: "" },
  { n: "АГС-30", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 30, dmg: "як снаряд", modes: "автомат", w: 16, cal: "30мм снаряд", p: 0, note: "" },
  { n: "РГ-6 «Бульдог»", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 6, dmg: "як снаряд", modes: "напівавтомат", w: 6, cal: "40мм снаряд", p: 0, note: "" },
  { n: "ДШК", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "3к10", modes: "автомат", w: 34, cal: "12.7×108", p: 0, note: "Стрічкове живлення.", mods: ["heavy"] },
  { n: "Штик-ніж", g: "Холодна зброя", skill: "melee", range: "", mag: 0, dmg: "к10+1", modes: "", w: 0.5, cal: "", p: 500, note: "Після руху хоча б 2 м по прямій: прицільний удар як додаткова дія." },
];
export const GUN_GROUPS = ["Пістолети", "Гвинтівки", "Дробовики", "Важка зброя", "Холодна зброя"];

export interface ArmorEntry { n: string; kin: number; acid: number; fire: number; elec: number; rad: number; w: number; slots: number; p: number; note?: string }
const OVER = "Можна вдягнути поверх деяких комбінезонів.";
/** Armour from the GM's document of 2026-11-14, in its order. The document gives no weight or price for the helmet. */
export const ARMORS: ArmorEntry[] = [
  { n: "Шкіряна куртка", kin: 2, acid: 2, fire: 2, elec: 2, rad: 0, w: 3, slots: 1, p: 1000 },
  { n: "Бандитська куртка", kin: 3, acid: 3, fire: 3, elec: 0, rad: 0, w: 3, slots: 1, p: 2000 },
  { n: "Комбінезон найманця", kin: 4, acid: 0, fire: 5, elec: 4, rad: 5, w: 5, slots: 1, p: 6000 },
  { n: "Комбінезон «Зоря»", kin: 6, acid: 0, fire: 7, elec: 7, rad: 10, w: 5, slots: 2, p: 15000 },
  { n: "Бронекостюм «Берилл-5М»", kin: 9, acid: 5, fire: 5, elec: 5, rad: 5, w: 7, slots: 0, p: 24000 },
  { n: "ССП-99 «Еколог»", kin: 3, acid: 14, fire: 14, elec: 14, rad: 25, w: 4, slots: 3, p: 15000, note: "Вбудована фільтрація повітря. Не для бою." },
  { n: "Комбінезон «СЕВА»", kin: 7, acid: 10, fire: 11, elec: 14, rad: 25, w: 5, slots: 4, p: 30000 },
  { n: "ССП-99М", kin: 6, acid: 14, fire: 14, elec: 14, rad: 25, w: 5, slots: 4, p: 50000 },
  { n: "Вітер Свободи", kin: 5, acid: 5, fire: 8, elec: 8, rad: 10, w: 3, slots: 3, p: 10000 },
  { n: "ПСЗ-9 «Броня Долгу»", kin: 8, acid: 0, fire: 7, elec: 7, rad: 10, w: 5, slots: 1, p: 28000 },
  { n: "СКАТ-9М", kin: 12, acid: 7, fire: 9, elec: 11, rad: 20, w: 12, slots: 1, p: 80000, note: "Шолом «Сфера М12» уже в комплекті." },
  { n: "Екзоскелет", kin: 15, acid: 7, fire: 7, elec: 7, rad: 10, w: 15, slots: 2, p: 100000, note: "Без Ривка, Спритність −1." },
  { n: "Військовий бронежилет", kin: 4, acid: 0, fire: 2, elec: 0, rad: 0, w: 3, slots: 0, p: 4000, note: OVER },
  { n: "Шкіряний плащ", kin: 1, acid: 1, fire: 1, elec: 2, rad: 2, w: 2, slots: 0, p: 2500, note: OVER },
  { n: "Шолом «Сфера М12»", kin: 1, acid: 5, fire: 1, elec: 2, rad: 10, w: 0, slots: 0, p: 0, note: "Поверх костюма без вбудованого шолома. Вага й ціна в правилах не вказані." },
];

/** Attachments and features: what each does, from the GM's documents. */
export const MOD_INFO: Record<ModKind, { name: string; info: string }> = {
  optic: { name: "Оптичний приціл", info: "+1 до влучання на 50 м і далі; доданий (не вбудований) ще й збільшує дальність на крок; 2000 куп." },
  colim: { name: "Коліматорний приціл", info: "+1 до влучання до 50 м; 1500 куп." },
  laser: { name: "Лазерний цілевказівник", info: "+1 по одній цілі: одиночний, напівавтомат, черга; 1500 куп." },
  silencer: { name: "Глушник", info: "ворог не має +2 до виявлення після пострілу" },
  grip: { name: "Ергономічна рукоятка", info: "швидке вихоплювання: −2 до кидка" },
  bulky: { name: "Громіздка зброя", info: "швидке вихоплювання: +2 до кидка" },
  heavy: { name: "Важкий калібр", info: "10 на влучання: +3 шкоди, повз кінетичну броню" },
  bayonet: { name: "Штик-ніж", info: "ближній бій к10+1; 1500 куп." },
  bigmag: { name: "Побільшений магазин", info: "більше набоїв у магазині" },
  doublemag: { name: "Подвійний магазин", info: "раз перезарядити додатковою дією; не разом із побільшеним" },
  bipod: { name: "Сошки", info: "без штрафу за стрільбу лежачи" },
  gl40: { name: "40-мм гранатомет", info: "Середня, 1 постріл, шкода як снаряд, 1,5 кг; 5000 куп." },
  burst0: { name: "Черга без штрафу", info: "черга з трьох без −1" },
  reliable: { name: "Надійна", info: "клинить лише після п’яти одиниць на к10" },
  fragile: { name: "Ненадійна", info: "кожна 1 на к10 рахується за дві" },
  other: { name: "Своя модифікація", info: "" },
};
/** Offered in the add list, in this order. */
export const MOD_CHOICES: ModKind[] = ["optic", "colim", "laser", "silencer", "grip", "bayonet", "bigmag", "doublemag", "bipod", "gl40", "heavy", "bulky", "burst0", "reliable", "fragile", "other"];
export interface ModPreset { name: string; kind: ModKind; bonus: number }
export const modPreset = (kind: ModKind): ModPreset => ({ name: MOD_INFO[kind].name, kind, bonus: kind === "optic" || kind === "colim" || kind === "laser" ? 1 : 0 });

/** Food and water the rest window can take from the backpack, by item name: rations per unit. */
export const FOOD: Record<string, number> = { "Сніданок туриста": 1, "MRE": 1, "Хліб": 0.5, "Ковбаса": 0.5 };
export const WATER = "Вода, 1 л";

/** what "Своя зброя" starts from */
export const CUSTOM_GUN: GunEntry = { n: "Нова зброя", g: "", skill: "rifles", range: "", mag: 10, dmg: "", modes: "", w: 4, cal: "7.62×54", p: 0, note: "" };

export const WEAPON_SKILLS: SkillKey[] = ["rifles", "pistols", "heavy", "melee", "unarmed"];
export const REROLL_OPTIONS: [string, string][] = [["", "немає"], ["rifles", "гвинтівки"], ["pistols", "пістолети"], ["heavy", "важка зброя"], ["any", "будь-яка зброя"]];

/* ---------- artefacts ---------- */
export const ART_TYPES: [ArtType, string][] = [["grav", "Гравітаційний"], ["therm", "Термічний"], ["elec", "Електричний"], ["chem", "Хімічний"], ["unique", "Унікальний"]];
export const ART_RARITY: [ArtRarity, string][] = [["common", "Поширений"], ["rare", "Рідкісний"], ["unique", "Унікальний"]];
/** What an artefact may change, in the order the GM's form offers it. `good` is the sign that helps the wearer. */
export const ART_FX_INFO: { key: ArtFxKey; name: string; short: string; good: 1 | -1 }[] = [
  { key: "spr", name: "Спритність", short: "Спритність", good: 1 },
  { key: "til", name: "Тілобудова", short: "Тілобудова", good: 1 },
  { key: "spy", name: "Сприйняття", short: "Сприйняття", good: 1 },
  { key: "rea", name: "Реакція", short: "Реакція", good: 1 },
  { key: "mud", name: "Мудрість", short: "Мудрість", good: 1 },
  { key: "kin", name: "Кінетична броня", short: "кінетична броня", good: 1 },
  { key: "acid", name: "Захист від кислоти", short: "захист від кислоти", good: 1 },
  { key: "fire", name: "Захист від вогню", short: "захист від вогню", good: 1 },
  { key: "elec", name: "Захист від електрики", short: "захист від електрики", good: 1 },
  { key: "rad", name: "Захист від радіації", short: "захист від радіації", good: 1 },
  { key: "radTurn", name: "Радіація на початку ходу (+ накопичує, − виводить)", short: "рад за хід", good: -1 },
];

export interface ArtifactEntry {
  n: string; type: ArtType; rarity: ArtRarity;
  /** what it looks like and where it is found */
  d: string;
  /** effects the sheet does not count, in words */
  note: string;
  fx: ArtFx;
  p: number;
  /** properties hidden from players until the GM unticks it */
  secret: boolean;
}
const art = (n: string, type: ArtType, rarity: ArtRarity, fx: ArtFx, d: string, note = ""): ArtifactEntry => ({ n, type, rarity, d, note, fx, p: 0, secret: true });
const LONGER = "Рана кровить удвічі довше.";
/**
 * The artefacts of the GM's document of 2026-11-14, by its headings. Rarity follows the document's anomaly lists:
 * (1) common, (2) rare, (3) unique. The document gives no prices. Descriptions are short retellings.
 */
export const ARTIFACTS: ArtifactEntry[] = [
  art("Слиз", "chem", "common", { fire: -4, acid: -4 }, "Із «Холодцю». Згущує кров, але тіло гірше тримає опіки.", "Кровотеча на 3 раунди коротша."),
  art("Слимак", "chem", "common", { fire: -4, acid: -4 }, "Із «Холодцю». Сильніше згортає кров.", "Кровотеча на 5 раундів коротша."),
  art("Слюда", "chem", "rare", { fire: -8, acid: -8 }, "Напівпрозорий твердий артефакт із «Холодцю», рідкісний і дорогий.", "Кровотеча на 7 раундів коротша."),
  art("Плівка", "chem", "unique", { acid: 8 }, "Дуже рідкісна. Відштовхує їдкі речовини."),
  art("Колючка", "chem", "common", { radTurn: -5 }, "Із «Жалкого пуху». Шипи ятрять тіло, зате виводять радіацію.", LONGER),
  art("Кристальна колючка", "chem", "rare", { radTurn: -10 }, "Кристалізується в «Жалкому пуху». Виводить радіацію разом із кров'ю.", LONGER),
  art("Морський їжак", "chem", "unique", { radTurn: -15 }, "Рідко трапляється в «Жалкому пуху». Піднімає тиск і виводить радіацію.", LONGER),
  art("Медуза", "grav", "common", { kin: 1, radTurn: 5 }, "Із «Трампліна». Слабке захисне поле, що трохи фонить."),
  art("Кам'яна квітка", "grav", "common", { kin: 2, radTurn: 5 }, "Із «Трампліна». Металеві вкраплення красиво грають на світлі."),
  art("Нічна зірка", "grav", "rare", { kin: 4, radTurn: 15 }, "Із «Трампліна». Надзвичайно рідкісна й дорога, сильно фонить."),
  art("Мамине намисто", "grav", "unique", { kin: 4 }, "Самі лише добрі властивості. Вчені платять за нього великі гроші."),
  art("Граві", "grav", "common", { radTurn: 5 }, "Утворюється, коли гравітація довго діє на металеві предмети.", "Чи кровить рана: кидок 2к10 замість 1к10."),
  art("Виверт", "grav", "common", { radTurn: -10 }, "Химерна губка з місць сильної гравітації. Вбирає радіацію."),
  art("Золота рибка", "grav", "common", { radTurn: 5 }, "Із «Воронки», оживає від тепла тіла.", "Чи кровить рана: кидок 3к10 замість 1к10."),
  art("Колобок", "grav", "rare", {}, "Шкіра під ним грубішає: кулю не зупинить, але різати важче.", "Чи кровить рана: кидок 5к10 замість 1к10."),
  art("Кров каменю", "grav", "common", { kin: -2 }, "Біля «Каруселі». Червонувате спресоване утворення з рослин, ґрунту й кісток.", "Рани й здоров'я відновлюються вдвічі швидше."),
  art("Шмат м'яса", "grav", "common", { kin: -2 }, "Із «Каруселі». Пришвидшує поділ клітин, але молоді тканини вразливіші.", "Рани й здоров'я відновлюються втричі швидше."),
  art("Душа", "grav", "rare", { kin: -3 }, "Дуже рідко біля «Каруселі». Мало хто її бачив.", "Рани й здоров'я відновлюються вчетверо швидше."),
  art("Бенгальський вогонь", "elec", "common", { spr: 1, elec: -4 }, "Біля «Електри». Недорогий, але дослідники його цінують."),
  art("Спалах", "elec", "rare", { spr: 2, elec: -6 }, "Зрідка з «Електри». Сталкери його люблять."),
  art("Місячне сяйво", "elec", "unique", { spr: 3, elec: -8 }, "Округлий, рідкісний випадок активності «Електри»."),
  art("Батарейка", "elec", "unique", { spr: 3 }, "Містить діелектрики. Як утворюється, науці невідомо."),
  art("Краплі", "therm", "common", { radTurn: -5, spr: -1 }, "Із «Жарки»: почорніла крапля з тріснутою глянцевою поверхнею."),
  art("Вогняна куля", "therm", "common", { radTurn: -10, spr: -1 }, "Кристалізується в «Жарці». Теплий, виводить радіацію, але виснажує м'язи."),
  art("Кристал", "therm", "rare", { radTurn: -15, spr: -2 }, "Важкий метал, що потрапив у «Жарку». Цінується, добути важко."),
  art("Полум'я", "therm", "unique", { fire: 8 }, "Рідкісне. Тримає 37 °C на два метри навколо."),
];
