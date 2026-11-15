// The GM's menu: the catalogue players take things from. Only the GM reaches this screen (route /gm).
// Taking a thing copies it into the sheet, so editing or deleting an entry here never changes anyone's sheet
// (one exception: making an artefact's properties public reveals them on every sheet that holds a copy).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { produce } from "immer";
import { GmFrame } from "./gm/Frame";
import { DEFAULT_CATALOG, gunGroups, itemGroups, newCatArmor, newCatArtifact, newCatGun, newCatItem, type CatArmor, type CatArtifact, type CatGun, type CatItem, type CatKind } from "../rules/catalog";
import { ART_FX_INFO, ART_RARITY, ART_TYPES, ITEM_FX_INFO, MOD_CHOICES, MOD_INFO, SKILL_NAME, WEAPON_SKILLS, marketName } from "../rules/data";
import { itemFxText } from "../rules/character";
import type { ArtRarity, ArtType, ModKind, SkillKey } from "../rules/types";
import { FxChips } from "./sheet/PackTab";
import { useCampaign } from "../state/context";
import { cx, kg } from "../util";
import { Area, Box, Btn, Check, Confirm, Lab, NumIn, Text } from "./bits";

const KINDS: [CatKind, string][] = [["guns", "Зброя"], ["armors", "Броня"], ["items", "Речі"], ["artifacts", "Артефакти"]];
const RARITY_NAME = Object.fromEntries(ART_RARITY) as Record<string, string>;
const RANGES = ["Близька", "Коротка", "Середня", "Далека", "Екстремальна"];
const TITLE: Record<CatKind, [string, string]> = { guns: ["Нова зброя", "Зброя"], items: ["Нова річ", "Річ"], armors: ["Нова броня", "Броня"], artifacts: ["Новий артефакт", "Артефакт"] };

/** One entry being edited in the dialog, with its kind. */
type Draft = { kind: "guns"; e: CatGun } | { kind: "items"; e: CatItem } | { kind: "armors"; e: CatArmor } | { kind: "artifacts"; e: CatArtifact };

export function GmMenu() {
  const [st, camp] = useCampaign();
  const [kind, setKind] = useState<CatKind>("guns");
  const [q, setQ] = useState("");
  // every entry is edited in a dialog over the list, on a draft: a changed group or type would move it in the list
  const [dlg, setDlg] = useState<{ d: Draft; isNew: boolean } | null>(null);
  const cat = st.catalog;

  const remove = (k: CatKind, id: string) => camp.updateCatalog(c => {
    if (k === "guns") c.guns = c.guns.filter(e => e.id !== id);
    else if (k === "items") c.items = c.items.filter(e => e.id !== id);
    else if (k === "artifacts") c.artifacts = c.artifacts.filter(e => e.id !== id);
    else c.armors = c.armors.filter(e => e.id !== id);
  });
  /** Writes the draft into the catalogue. Making an artefact's properties public reveals them on every sheet that holds a copy. */
  const save = (d: Draft, was: Draft | null) => {
    camp.updateCatalog(c => {
      const list = c[d.kind] as { id: string }[];
      const i = list.findIndex(e => e.id === d.e.id);
      if (i >= 0) list[i] = d.e; else list.push(d.e);
    });
    if (d.kind === "artifacts" && !d.e.secret && (!was || (was.e as CatArtifact).secret)) {
      const id = d.e.id;
      for (const sid of Object.keys(st.mine)) camp.update(sid, x => { for (const it of x.artifacts) if (it.catId === id && it.secret) it.secret = false; });
    }
    setDlg(null);
    if (!was) {
      setQ("");
      // the new entry lands in its group, which may be far down the list
      window.setTimeout(() => document.getElementById("cat-" + d.e.id)?.scrollIntoView({ block: "center" }), 60);
    }
  };
  const add = () => {
    const d: Draft = kind === "guns" ? { kind, e: newCatGun() } : kind === "items" ? { kind, e: newCatItem() } : kind === "artifacts" ? { kind, e: newCatArtifact() } : { kind: "armors", e: newCatArmor() };
    setDlg({ d, isNew: true });
  };
  const open = (d: Draft) => setDlg({ d, isNew: false });
  const match = (name: string) => !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());

  let body: ReactNode;
  if (kind === "guns") {
    const list = cat.guns.filter(g => match(g.n));
    body = gunGroups(list).map(grp => {
      const xs = list.filter(g => g.g === grp);
      if (!xs.length) return null;
      return (
        <div key={grp}>
          <div className="wgh lbl">{grp}</div>
          {xs.map(g => (
            <Entry key={g.id} id={g.id} name={g.n} price={g.p} hidden={!!g.hidden} edit={() => open({ kind: "guns", e: g })}
              meta={[g.range, g.dmg, g.cal, g.mag ? `магазин ${g.mag}` : "", g.nato ? "НАТО" : "", kg(g.w) + " кг"].filter(Boolean).join(" · ")}
              extra={(g.mods ?? []).map(k => MOD_INFO[k].name).join(", ")} />
          ))}
        </div>
      );
    });
  } else if (kind === "items") {
    const list = cat.items.filter(m => match(marketName(m)));
    body = itemGroups(list).map(grp => (
      <div key={grp}>
        <div className="wgh lbl">{grp}</div>
        {list.filter(m => m.g === grp).map(m => (
          <Entry key={m.id} id={m.id} name={marketName(m) || "Без назви"} price={m.p} hidden={!!m.hidden} edit={() => open({ kind: "items", e: m })}
            meta={[m.ammo ? "" : kg(m.w ?? 0) + " кг", m.uses ? `використань ${m.uses}` : "", m.fx ? `«Вжити»: ${itemFxText(m.fx)}` : ""].filter(Boolean).join(" · ")}
            extra={m.d} />
        ))}
      </div>
    ));
  } else if (kind === "artifacts") {
    const list = cat.artifacts.filter(a => match(a.n));
    body = ART_TYPES.map(([t, tn]) => {
      const xs = list.filter(a => a.type === t);
      if (!xs.length) return null;
      return (
        <div key={t}>
          <div className="wgh lbl">{tn}</div>
          {xs.map(a => (
            <Entry key={a.id} id={a.id} name={a.n} price={a.p} hidden={!!a.hidden} edit={() => open({ kind: "artifacts", e: a })}
              meta={[RARITY_NAME[a.rarity], a.secret ? "властивості приховані" : "властивості відомі"].join(" · ")} extra={a.note}
              chips={<FxChips fx={a.fx} />} />
          ))}
        </div>
      );
    });
  } else {
    body = cat.armors.filter(a => match(a.n)).map(a => (
      <Entry key={a.id} id={a.id} name={a.n} price={a.p} hidden={!!a.hidden} edit={() => open({ kind: "armors", e: a })}
        meta={`кін ${a.kin} · кисл ${a.acid} · вог ${a.fire} · ел ${a.elec} · рад ${a.rad} · ${kg(a.w)} кг · контейнерів ${a.slots}`} extra={a.note} />
    ));
  }
  const empty = !cat[kind].length ? "Тут поки порожньо." : q.trim() ? "Нічого не знайдено." : "";

  return (
    <GmFrame sec="gm" sub="Каталог, з якого гравці беруть речі" sync={st.catalogSync}>
      <nav className="tabs gmtabs" aria-label="Розділи каталогу">
        {KINDS.map(([k, n]) => (
          <button type="button" key={k} className={cx("tab", kind === k && "on")} aria-current={kind === k ? "page" : undefined} onClick={() => setKind(k)}>
            {n} <span className="num">{cat[k].length}</span>
          </button>
        ))}
      </nav>
      <div className="row wrapg gmbar">
        <input className="in" style={{ flex: "1 1 12em" }} placeholder="Пошук за назвою" aria-label="Пошук за назвою" value={q} onChange={e => setQ(e.target.value)} />
        <Btn pri onClick={add}>+ Додати</Btn>
      </div>
      <Box title={KINDS.find(x => x[0] === kind)![1]}>
        <div>{empty ? <p className="empty">{empty}</p> : body}</div>
      </Box>
      {dlg && <EntryDialog key={dlg.d.e.id} start={dlg.d} isNew={dlg.isNew} gunGroups={gunGroups(cat.guns)} itemGroups={itemGroups(cat.items)}
        close={() => setDlg(null)} save={d => save(d, dlg.isNew ? null : dlg.d)} remove={() => { remove(dlg.d.kind, dlg.d.e.id); setDlg(null); }} />}
      <div className="gmfoot">
        <Confirm sm={false} label="Повернути стандартний каталог" ask="Точно? Усі зміни каталогу зникнуть" title="Повернути стандартний каталог"
          onConfirm={() => camp.updateCatalog(() => structuredClone(DEFAULT_CATALOG))} />
      </div>
    </GmFrame>
  );
}

/** One catalogue entry in the list: name, numbers, price; «Змінити» opens the dialog. */
function Entry({ id, name, meta, extra, chips, price, hidden, edit }: {
  id: string; name: string; meta: string; extra?: string; chips?: ReactNode; price: number; hidden: boolean; edit: () => void;
}) {
  return (
    <div className={cx("card", hidden && "hid")} id={"cat-" + id}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <b style={{ overflowWrap: "anywhere" }}>{name}{hidden && <span className="chip tagc">приховано</span>}</b>
          {meta && <span className="hint num">{meta}</span>}
          {chips}
          {extra && <span className="hint">{extra}</span>}
        </div>
        <div className="row" style={{ flex: "none" }}>
          <span className="hint num" style={{ whiteSpace: "nowrap" }}>{price ? `${price} куп.` : "без ціни"}</span>
          <Btn sm onClick={edit}>Змінити</Btn>
        </div>
      </div>
    </div>
  );
}

/** What stops a draft from being saved, or "". */
function problem(d: Draft): string {
  const name = d.kind === "items" ? (d.e.ammo ? d.e.cal ?? "" : d.e.n ?? "") : d.e.n;
  if (!name.trim()) return d.kind === "items" && d.e.ammo ? "Немає калібру." : "Немає назви.";
  if ((d.kind === "guns" || d.kind === "items") && !d.e.g.trim()) return "Обери групу.";
  return "";
}

/**
 * The form over the list. Changes stay in a draft until «Додати» or «Зберегти»; «Скасувати», × and Escape drop them,
 * so an unfinished entry never shows up in the catalogue.
 */
function EntryDialog({ start, isNew, gunGroups, itemGroups, save, remove, close }: {
  start: Draft; isNew: boolean; gunGroups: string[]; itemGroups: string[]; save: (d: Draft) => void; remove: () => void; close: () => void;
}) {
  const [d, setD] = useState<Draft>(() => structuredClone(start));
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // the parent passes a new close on every render; keep the latest without refocusing the dialog on each keystroke
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // one setter per kind keeps the fields typed; the draft's kind never changes
  const edit = <T,>(fn: (x: T) => void) => { setErr(""); setD(prev => produce(prev, p => { fn(p.e as T); })); };
  const submit = () => {
    const why = problem(d);
    if (why) { setErr(why); return; }
    save(d);
  };
  return (
    <div className="overlay" role="presentation">
      <div className="dialog wide box" role="dialog" aria-modal="true" aria-labelledby="cat-dlg-title" tabIndex={-1} ref={box}>
        <h2 id="cat-dlg-title"><span>{TITLE[d.kind][isNew ? 0 : 1]}</span><Btn sm aria-label="Закрити" onClick={close}>×</Btn></h2>
        <div className="pad">
          {d.kind === "guns" && <GunFields g={d.e} groups={gunGroups} set={edit<CatGun>} />}
          {d.kind === "items" && <ItemFields m={d.e} groups={itemGroups} set={edit<CatItem>} />}
          {d.kind === "armors" && <ArmorFields a={d.e} set={edit<CatArmor>} />}
          {d.kind === "artifacts" && <ArtifactFields a={d.e} set={edit<CatArtifact>} />}
          <Check checked={!!d.e.hidden} set={v => edit<{ hidden?: boolean }>(x => { if (v) x.hidden = true; else delete x.hidden; })}>
            Приховано від гравців: немає в їхньому списку, видає лише майстер
          </Check>
          {err && <div className="neg">{err}</div>}
          <div className="row between wrapg">
            <div className="row">
              <Btn pri onClick={submit}>{isNew ? "Додати" : "Зберегти"}</Btn>
              <Btn onClick={close}>Скасувати</Btn>
            </div>
            {!isNew && <Confirm sm={false} label="Видалити з каталогу" ask="Точно видалити?" title="Видалити з каталогу" onConfirm={remove} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A group from the list, or a new one typed in. A new entry starts with none chosen. */
export function GroupField({ value, groups, set }: { value: string; groups: string[]; set: (v: string) => void }) {
  const [own, setOwn] = useState(value !== "" && !groups.includes(value));
  return <>
    <Lab name="Група" className="wsm">
      <select className="in" value={own ? "__new" : value} onChange={e => { const v = e.target.value; setOwn(v === "__new"); set(v === "__new" ? "" : v); }}>
        <option value="" disabled>— обери групу —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
        <option value="__new">Нова група…</option>
      </select>
    </Lab>
    {own && <Lab name="Назва нової групи"><Text value={value} set={set} /></Lab>}
  </>;
}

/**
 * Numbers picked from a list: only the picked ones show, each with its number and ×.
 * Used for what an artefact changes and for what an item's «Вжити» does.
 */
function FxPicker<K extends string>({ title, info, fx, set, empty, hint }: {
  title: string; info: { key: K; name: string; start: number }[]; fx: Partial<Record<K, number>>;
  set: (fn: (fx: Partial<Record<K, number>>) => void) => void; empty: string; hint: string;
}) {
  const [pick, setPick] = useState<K | "">("");
  const have = info.filter(f => fx[f.key] !== undefined), free = info.filter(f => fx[f.key] === undefined);
  const next = free.find(f => f.key === pick) ?? free[0];
  return (
    <div className="fl wide">
      <span>{title}</span>
      {have.length === 0 && <div className="hint">{empty}</div>}
      {have.map(f => (
        <div className="row fxrow" key={f.key}>
          <span className="fxn">{f.name}</span>
          <NumIn className="w4 num" min={-9999} label={f.name} value={fx[f.key] ?? 0} set={v => set(x => { x[f.key] = Math.round(v); })} />
          <Btn sm aria-label={`Прибрати: ${f.name}`} onClick={() => set(x => { delete x[f.key]; })}>×</Btn>
        </div>
      ))}
      {next && (
        <div className="row wrapg">
          <select className="in" aria-label="Що додати" value={next.key} onChange={e => setPick(e.target.value as K)}>
            {free.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
          <Btn onClick={() => { set(x => { x[next.key] = next.start; }); setPick(""); }}>Додати</Btn>
        </div>
      )}
      <div className="hint">{hint}</div>
    </div>
  );
}

function GunFields({ g, groups, set }: { g: CatGun; groups: string[]; set: (fn: (x: CatGun) => void) => void }) {
  const [mod, setMod] = useState<ModKind>("optic");
  const mods = g.mods ?? [];
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={g.n} set={v => set(x => { x.n = v; })} /></Lab>
      <GroupField value={g.g} groups={groups} set={v => set(x => { x.g = v; })} />
      <Lab name="Навичка" className="wsm"><select className="in" value={g.skill} onChange={e => set(x => { x.skill = e.target.value as SkillKey; })}>{WEAPON_SKILLS.map(k => <option key={k} value={k}>{SKILL_NAME[k]}</option>)}</select></Lab>
      <Lab name="Дальність"><select className="in" value={g.range} onChange={e => set(x => { x.range = e.target.value; })}><option value="">—</option>{RANGES.map(r => <option key={r} value={r}>{r}</option>)}</select></Lab>
      <Lab name="Шкода"><Text value={g.dmg} placeholder="2к10" set={v => set(x => { x.dmg = v; })} /></Lab>
      <Lab name="Магазин"><NumIn value={g.mag} set={v => set(x => { x.mag = Math.round(v); })} /></Lab>
      <Lab name="Режими вогню"><Text value={g.modes} placeholder="одиночний, черга" set={v => set(x => { x.modes = v; })} /></Lab>
      <Lab name="Вага, кг"><NumIn value={g.w} set={v => set(x => { x.w = v; })} /></Lab>
      <Lab name="Калібр"><Text value={g.cal} set={v => set(x => { x.cal = v; })} /></Lab>
      <Lab name="Ціна, куп."><NumIn value={g.p} set={v => set(x => { x.p = Math.round(v); })} /></Lab>
      <Check wide checked={!!g.nato} set={v => set(x => { if (v) x.nato = true; else delete x.nato; })}>Зброя НАТО, +1 до влучання</Check>
      <div className="fl wide">
        <span>Модифікації й особливості</span>
        {mods.length > 0 && <div className="chips">{mods.map(k => (
          <span key={k} className="chip">{MOD_INFO[k].name}<button type="button" aria-label={`Прибрати: ${MOD_INFO[k].name}`} onClick={() => set(x => { x.mods = (x.mods ?? []).filter(m => m !== k); })}>×</button></span>
        ))}</div>}
        <div className="row wrapg">
          <select className="in" aria-label="Яку модифікацію додати" value={mod} onChange={e => setMod(e.target.value as ModKind)}>
            {MOD_CHOICES.filter(k => k !== "other").map(k => <option key={k} value={k}>{MOD_INFO[k].name}</option>)}
          </select>
          <Btn disabled={mods.includes(mod)} onClick={() => set(x => { x.mods = [...(x.mods ?? []), mod]; })}>Додати</Btn>
        </div>
      </div>
      <Lab name="Нотатка" wide><Text value={g.note} set={v => set(x => { x.note = v; })} /></Lab>
    </div>
  );
}

function ItemFields({ m, groups, set }: { m: CatItem; groups: string[]; set: (fn: (x: CatItem) => void) => void }) {
  return (
    <div className="fgrid">
      <Check wide checked={!!m.ammo} set={v => set(x => {
        if (v) { x.ammo = true; x.cal = x.cal || ""; x.pack = x.pack || 30; delete x.n; delete x.w; }
        else { delete x.ammo; delete x.cal; delete x.pack; x.n = x.n || ""; x.w = x.w ?? 0; }
      })}>Набої: назва складається з калібру й кількості</Check>
      {m.ammo ? <>
        <Lab name="Калібр"><Text value={m.cal ?? ""} placeholder="5.45×39" set={v => set(x => { x.cal = v; })} /></Lab>
        <Lab name="Набоїв у пачці"><NumIn value={m.pack ?? 1} min={1} set={v => set(x => { x.pack = Math.max(1, Math.round(v)); })} /></Lab>
      </> : <>
        <Lab name="Назва" wide><Text value={m.n ?? ""} set={v => set(x => { x.n = v; })} /></Lab>
        <Lab name="Вага однієї, кг"><NumIn value={m.w ?? 0} set={v => set(x => { x.w = v; })} /></Lab>
      </>}
      <GroupField value={m.g} groups={groups} set={v => set(x => { x.g = v; })} />
      <Lab name="Ціна, куп."><NumIn value={m.p} set={v => set(x => { x.p = Math.round(v); })} /></Lab>
      <Lab name="Використань у наборі"><NumIn value={m.uses ?? 0} set={v => set(x => { if (v > 0) x.uses = Math.round(v); else delete x.uses; })} /></Lab>
      {!m.ammo && (
        <FxPicker title="Що робить кнопка «Вжити»" info={ITEM_FX_INFO} fx={m.fx ?? {}}
          set={fn => set(x => { const fx = { ...(x.fx ?? {}) }; fn(fx); if (Object.keys(fx).length) x.fx = fx; else delete x.fx; })}
          empty="Нічого: у гравця кнопки «Вжити» не буде."
          hint="Кожне «Вжити» знімає одну штуку, а з набору одне використання. Радіація: мінус виводить, плюс додає." />
      )}
      <Lab name="Опис" wide><Text value={m.d ?? ""} set={v => set(x => { if (v) x.d = v; else delete x.d; })} /></Lab>
    </div>
  );
}

function ArmorFields({ a, set }: { a: CatArmor; set: (fn: (x: CatArmor) => void) => void }) {
  const field = (name: string, key: "kin" | "acid" | "fire" | "elec" | "rad" | "w" | "slots" | "p") =>
    <Lab name={name}><NumIn value={a[key]} set={v => set(x => { x[key] = key === "w" ? v : key === "slots" ? Math.min(5, Math.round(v)) : Math.round(v); })} /></Lab>;
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={a.n} set={v => set(x => { x.n = v; })} /></Lab>
      {field("Кінетика", "kin")}{field("Кислота", "acid")}{field("Вогонь", "fire")}{field("Електрика", "elec")}{field("Радіація", "rad")}
      {field("Вага, кг", "w")}{field("Контейнери, 0–5", "slots")}{field("Ціна, куп.", "p")}
      <Lab name="Опис" wide><Text value={a.note ?? ""} set={v => set(x => { if (v) x.note = v; else delete x.note; })} /></Lab>
    </div>
  );
}

/**
 * One artefact. Effects the sheet counts are picked from a list and given a number; anything it cannot count
 * (bleeding, healing) goes in words. While its properties are hidden from players, the artefact does nothing.
 */
function ArtifactFields({ a, set }: { a: CatArtifact; set: (fn: (x: CatArtifact) => void) => void }) {
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={a.n} set={v => set(x => { x.n = v; })} /></Lab>
      <Lab name="Тип"><select className="in" value={a.type} onChange={e => set(x => { x.type = e.target.value as ArtType; })}>{ART_TYPES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Lab>
      <Lab name="Поширеність"><select className="in" value={a.rarity} onChange={e => set(x => { x.rarity = e.target.value as ArtRarity; })}>{ART_RARITY.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Lab>
      <Lab name="Ціна, куп."><NumIn value={a.p} set={v => set(x => { x.p = Math.round(v); })} /></Lab>
      <Lab name="Опис" wide><Area value={a.d} rows={2} set={v => set(x => { x.d = v; })} /></Lab>
      <FxPicker title="Ефекти, які чарнік рахує сам" info={ART_FX_INFO.map(f => ({ ...f, start: f.key === "radTurn" ? 5 : 1 }))} fx={a.fx}
        set={fn => set(x => { fn(x.fx); })} empty="Жодного. Додай зі списку нижче."
        hint="Мінус ослаблює: −4 захисту від електрики означає +4 шкоди електрикою. У радіації за хід плюс накопичує, мінус виводить." />
      <Lab name="Інші ефекти словами" wide><Text value={a.note} placeholder="кровотеча, лікування" set={v => set(x => { x.note = v; })} /></Lab>
      <Check wide checked={a.secret} set={v => set(x => { x.secret = v; })}>Властивості приховані від гравців: поки приховані, артефакт не діє</Check>
    </div>
  );
}
