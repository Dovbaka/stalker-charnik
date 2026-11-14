// The GM's rules as data. Source: the rules document of the campaign.
import type { AttrKey, ItemEffect, ModKind, SkillKey } from "./types";

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

// Current rules document first, in its order (the creation wizard's basket keeps indices into this list),
// then the GM's earlier document. NATO flags of the earlier weapons are set by origin: that document marks
// NATO by colour, which does not survive text extraction.
const SHOT = "Дробовик ігнорує 5 кінетичної броні зблизька і 3 на короткій.";
export const GUNS: GunEntry[] = [
  { n: "Макаров (ПМм)", g: "Пістолети", skill: "pistols", range: "Близька", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 500, note: "", mods: ["fragile"] },
  { n: "Стєчкін (АПС)", g: "Пістолети", skill: "pistols", range: "Близька", mag: 20, dmg: "к10", modes: "напівавтомат, автомат", w: 1.5, cal: "9×18", p: 1500, note: "" },
  { n: "Фора-12м", g: "Пістолети", skill: "pistols", range: "Близька", mag: 12, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1500, note: "", mods: ["grip"] },
  { n: "ПБ-1с", g: "Пістолети", skill: "pistols", range: "Близька", mag: 8, dmg: "к10", modes: "напівавтомат", w: 0.5, cal: "9×18", p: 1000, note: "", mods: ["silencer"] },
  { n: "Walker P99", g: "Пістолети", skill: "pistols", range: "Близька", mag: 16, dmg: "к10+1", modes: "напівавтомат", w: 0.5, cal: "9×19", p: 2000, nato: true, note: "", mods: ["grip"] },
  { n: "MP-5", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 30, dmg: "к10+1", modes: "напівавтомат, автомат, по 3", w: 2.5, cal: "9×19", p: 2500, nato: true, note: "" },
  { n: "Обріз", g: "Дробовики", skill: "rifles", range: "Близька", mag: 2, dmg: "3к10", modes: "одиночний", w: 2, cal: "12×70 дріб", p: 2000, note: SHOT },
  { n: "Ніж", g: "Холодна зброя", skill: "melee", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 1000, note: "На 10 при поцілюванні: +3 шкоди, і вся шкода повз кінетичну броню." },
  { n: "Кастети", g: "Холодна зброя", skill: "unarmed", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 500, note: "" },
  { n: "Шиповані кастети", g: "Холодна зброя", skill: "unarmed", range: "", mag: 0, dmg: "к10", modes: "", w: 0.5, cal: "", p: 800, note: "Може викликати кровотечу." },
  // the GM's earlier document
  { n: "Токарєв (ТТ)", g: "Пістолети", skill: "pistols", range: "Близька", mag: 8, dmg: "к10", modes: "напівавтомат", w: 1, cal: "7.62×25", p: 0, note: "" },
  { n: "M1911", g: "Пістолети", skill: "pistols", range: "Близька", mag: 7, dmg: "к10+2", modes: "напівавтомат", w: 1, cal: ".45 ACP", p: 0, nato: true, note: "" },
  { n: "Desert Eagle", g: "Пістолети", skill: "pistols", range: "Близька", mag: 8, dmg: "к10+3", modes: "напівавтомат", w: 1, cal: ".44 Magnum", p: 0, nato: true, note: "", mods: ["heavy", "bulky"] },
  { n: "ПКШ-41", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 71, dmg: "к10", modes: "автомат", w: 3.5, cal: "7.62×25", p: 0, note: "" },
  { n: "АКМ 74/2 У", g: "Гвинтівки", skill: "rifles", range: "Коротка", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат", w: 3, cal: "5.45×39", p: 0, note: "" },
  { n: "АКМ 74/2", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат", w: 3.5, cal: "5.45×39", p: 0, note: "" },
  { n: "АН-94 «Абакан»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10", modes: "напівавтомат, автомат, по 3", w: 4, cal: "5.45×39", p: 0, note: "", mods: ["burst0"] },
  { n: "Enfield L85A1", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10+1", modes: "напівавтомат, автомат", w: 5, cal: "5.56×45", p: 0, nato: true, note: "", mods: ["optic"] },
  { n: "ZM Light Rifle 300", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10+1", modes: "напівавтомат, автомат", w: 3, cal: "5.56×45", p: 0, nato: true, note: "" },
  { n: "Sturmgewehr 550", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 30, dmg: "2к10+1", modes: "напівавтомат, автомат", w: 4, cal: "5.56×45", p: 0, nato: true, note: "", mods: ["reliable"] },
  { n: "АС «Вал»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 20, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 2.5, cal: "9×39", p: 0, note: "", mods: ["silencer"] },
  { n: "ОЦ-14 «Гроза»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 20, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 3, cal: "9×39", p: 0, note: "", mods: ["gl40"] },
  { n: "ВСС «Вінторєз»", g: "Гвинтівки", skill: "rifles", range: "Середня", mag: 10, dmg: "2к10+2", modes: "напівавтомат, автомат", w: 3, cal: "9×39", p: 0, note: "", mods: ["optic", "silencer"] },
  { n: "М91/30 «Мосіна»", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 5, dmg: "2к10+3", modes: "одиночний", w: 4, cal: "7.62×54", p: 0, note: "", mods: ["bulky"] },
  { n: "Galil", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 25, dmg: "2к10+3", modes: "напівавтомат, автомат", w: 4, cal: "7.62×54", p: 0, note: "" },
  { n: "FN FAL", g: "Гвинтівки", skill: "rifles", range: "Далека", mag: 30, dmg: "2к10+3", modes: "напівавтомат, автомат", w: 4, cal: "7.62×51 НАТО", p: 0, nato: true, note: "" },
  { n: "Драгунов (СВД)", g: "Гвинтівки", skill: "rifles", range: "Екстремальна", mag: 10, dmg: "2к10+3", modes: "напівавтомат", w: 5, cal: "7.62×54", p: 0, note: "", mods: ["heavy", "bulky"] },
  { n: "Гвинтівка Гаусса", g: "Гвинтівки", skill: "rifles", range: "Екстремальна", mag: 10, dmg: "3к10+3", modes: "напівавтомат", w: 5.5, cal: "2мм Гаусс", p: 0, note: "", mods: ["bulky"] },
  { n: "Мисливська рушниця", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 2, dmg: "3к10", modes: "одиночний", w: 2.5, cal: "12×70 дріб", p: 0, note: SHOT },
  { n: "Mossberg 930", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 6, dmg: "3к10", modes: "одиночний", w: 3, cal: "12×70 дріб", p: 0, nato: true, note: SHOT },
  { n: "SPAS-12", g: "Дробовики", skill: "rifles", range: "Коротка", mag: 8, dmg: "3к10", modes: "напівавтомат, автомат", w: 4.5, cal: "12×70 дріб", p: 0, nato: true, note: SHOT },
  { n: "ПКМ", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "2к10+3", modes: "автомат", w: 9, cal: "7.62×54", p: 0, note: "Стрічкове живлення." },
  { n: "FN Minimi", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "2к10+3", modes: "автомат", w: 7, cal: "7.62×51 НАТО", p: 0, nato: true, note: "Стрічкове живлення." },
  { n: "РПГ-7", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 1, dmg: "як снаряд", modes: "одиночний", w: 7, cal: "Заряд РПГ", p: 0, note: "" },
  { n: "АГС-30", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 30, dmg: "як снаряд", modes: "автомат", w: 16, cal: "30мм снаряд", p: 0, note: "" },
  { n: "РГ-6 «Бульдог»", g: "Важка зброя", skill: "heavy", range: "Середня", mag: 6, dmg: "як снаряд", modes: "напівавтомат", w: 6, cal: "40мм снаряд", p: 0, note: "" },
  { n: "ДШК", g: "Важка зброя", skill: "heavy", range: "Далека", mag: 100, dmg: "3к10", modes: "автомат", w: 34, cal: "12.7×108", p: 0, note: "Стрічкове живлення." },
  { n: "Штик-ніж", g: "Холодна зброя", skill: "melee", range: "", mag: 0, dmg: "к10+1", modes: "", w: 0.5, cal: "", p: 500, note: "Після руху хоча б 2 м по прямій: прицільний удар як додаткова дія." },
];
export const GUN_GROUPS = ["Пістолети", "Гвинтівки", "Дробовики", "Важка зброя", "Холодна зброя"];

/** Attachments and features: what each does, from the GM's documents. */
export const MOD_INFO: Record<ModKind, { name: string; info: string }> = {
  optic: { name: "Оптичний приціл", info: "+1 до влучання на 50 м і далі" },
  colim: { name: "Коліматорний приціл", info: "+1 до влучання до 50 м" },
  laser: { name: "Лазерний цілевказівник", info: "+1 по одній цілі: одиночний, напівавтомат, черга" },
  silencer: { name: "Глушник", info: "ворог не має +2 до виявлення після пострілу" },
  grip: { name: "Ергономічна рукоятка", info: "швидке вихоплювання: −2 до кидка" },
  bulky: { name: "Громіздка зброя", info: "швидке вихоплювання: +2 до кидка" },
  heavy: { name: "Важкий калібр", info: "10 на влучання: +3 шкоди, повз кінетичну броню" },
  bayonet: { name: "Штик-ніж", info: "ближній бій к10+1" },
  bigmag: { name: "Побільшений магазин", info: "більше набоїв у магазині" },
  doublemag: { name: "Подвійний магазин", info: "раз перезарядити вільною дією" },
  gl40: { name: "40-мм гранатомет", info: "Середня, 1 постріл, шкода як снаряд, 1,5 кг" },
  burst0: { name: "Черга без штрафу", info: "черга з трьох без −1" },
  reliable: { name: "Надійна", info: "клинить лише після п’яти одиниць на к10" },
  fragile: { name: "Ненадійна", info: "кожна 1 на к10 рахується за дві" },
  other: { name: "Своя модифікація", info: "" },
};
/** Offered in the add list, in this order. */
export const MOD_CHOICES: ModKind[] = ["optic", "colim", "laser", "silencer", "grip", "bayonet", "bigmag", "doublemag", "gl40", "heavy", "bulky", "burst0", "reliable", "fragile", "other"];
export interface ModPreset { name: string; kind: ModKind; bonus: number }
export const modPreset = (kind: ModKind): ModPreset => ({ name: MOD_INFO[kind].name, kind, bonus: kind === "optic" || kind === "colim" || kind === "laser" ? 1 : 0 });

/** Food and water the rest window can take from the backpack, by item name: rations per unit. */
export const FOOD: Record<string, number> = { "Сніданок туриста": 1, "MRE": 1, "Хліб": 0.5, "Ковбаса": 0.5 };
export const WATER = "Вода, 1 л";

/** what "Своя зброя" starts from */
export const CUSTOM_GUN: GunEntry = { n: "Нова зброя", g: "", skill: "rifles", range: "", mag: 10, dmg: "", modes: "", w: 4, cal: "7.62×54", p: 0, note: "" };

export const WEAPON_SKILLS: SkillKey[] = ["rifles", "pistols", "heavy", "melee", "unarmed"];
export const REROLL_OPTIONS: [string, string][] = [["", "немає"], ["rifles", "гвинтівки"], ["pistols", "пістолети"], ["heavy", "важка зброя"], ["any", "будь-яка зброя"]];
