// The GM's menu: the catalogue players take things from. Only the GM reaches this screen (route /gm).
// Taking a thing copies it into the sheet, so editing or deleting an entry here never changes anyone's sheet.
import { useState, type ReactNode } from "react";
import { navigate } from "../router";
import { DEFAULT_CATALOG, ITEM_FX, gunGroups, itemGroups, newCatArmor, newCatGun, newCatItem, type CatArmor, type CatGun, type CatItem, type CatKind } from "../rules/catalog";
import { GUN_GROUPS, MOD_CHOICES, MOD_INFO, SKILL_NAME, WEAPON_SKILLS, marketName } from "../rules/data";
import type { ItemEffect, ModKind, SkillKey } from "../rules/types";
import { useCampaign } from "../state/context";
import { cx, kg } from "../util";
import { Box, Btn, Check, Confirm, IconPeople, Lab, NumIn, Text } from "./bits";

const KINDS: [CatKind, string][] = [["guns", "Зброя"], ["armors", "Броня"], ["items", "Речі"]];
const RANGES = ["Близька", "Коротка", "Середня", "Далека", "Екстремальна"];

export function GmMenu() {
  const [st, camp] = useCampaign();
  const [kind, setKind] = useState<CatKind>("guns");
  const [open, setOpen] = useState("");
  const [q, setQ] = useState("");
  const cat = st.catalog;
  const status = st.catalogSync === "err" ? "Не збережено" : st.catalogSync === "saving" ? "Зберігаю" : "";

  const updGun = (id: string, fn: (x: CatGun) => void) => camp.updateCatalog(c => { const x = c.guns.find(e => e.id === id); if (x) fn(x); });
  const updItem = (id: string, fn: (x: CatItem) => void) => camp.updateCatalog(c => { const x = c.items.find(e => e.id === id); if (x) fn(x); });
  const updArmor = (id: string, fn: (x: CatArmor) => void) => camp.updateCatalog(c => { const x = c.armors.find(e => e.id === id); if (x) fn(x); });
  const remove = (k: CatKind, id: string) => camp.updateCatalog(c => {
    if (k === "guns") c.guns = c.guns.filter(e => e.id !== id);
    else if (k === "items") c.items = c.items.filter(e => e.id !== id);
    else c.armors = c.armors.filter(e => e.id !== id);
  });
  const add = () => {
    let id = "";
    camp.updateCatalog(c => {
      if (kind === "guns") { const e = newCatGun(); id = e.id; c.guns.push(e); }
      else if (kind === "items") { const e = newCatItem(); id = e.id; c.items.push(e); }
      else { const e = newCatArmor(); id = e.id; c.armors.push(e); }
    });
    setQ(""); setOpen(id);
    // the new entry lands in its group, which may be far down the list
    window.setTimeout(() => document.getElementById("cat-" + id)?.scrollIntoView({ block: "center" }), 60);
  };
  const toggle = (id: string) => setOpen(open === id ? "" : id);
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
            <Entry key={g.id} id={g.id} name={g.n} price={g.p} hidden={!!g.hidden} open={open === g.id} toggle={() => toggle(g.id)}
              meta={[g.range, g.dmg, g.cal, g.mag ? `магазин ${g.mag}` : "", g.nato ? "НАТО" : "", kg(g.w) + " кг"].filter(Boolean).join(" · ")}
              extra={(g.mods ?? []).map(k => MOD_INFO[k].name).join(", ")}
              setHidden={v => updGun(g.id, x => { if (v) x.hidden = true; else delete x.hidden; })} remove={() => remove("guns", g.id)}>
              <GunFields g={g} set={fn => updGun(g.id, fn)} />
            </Entry>
          ))}
        </div>
      );
    });
  } else if (kind === "items") {
    const list = cat.items.filter(m => match(marketName(m)));
    body = <>
      <datalist id="cat-groups">{itemGroups(cat.items).map(g => <option key={g} value={g} />)}</datalist>
      {itemGroups(list).map(grp => (
        <div key={grp}>
          <div className="wgh lbl">{grp}</div>
          {list.filter(m => m.g === grp).map(m => (
            <Entry key={m.id} id={m.id} name={marketName(m) || "Без назви"} price={m.p} hidden={!!m.hidden} open={open === m.id} toggle={() => toggle(m.id)}
              meta={[m.ammo ? "" : kg(m.w ?? 0) + " кг", m.uses ? `використань ${m.uses}` : "", m.d].filter(Boolean).join(" · ")}
              setHidden={v => updItem(m.id, x => { if (v) x.hidden = true; else delete x.hidden; })} remove={() => remove("items", m.id)}>
              <ItemFields m={m} set={fn => updItem(m.id, fn)} />
            </Entry>
          ))}
        </div>
      ))}
    </>;
  } else {
    const list = cat.armors.filter(a => match(a.n));
    body = list.map(a => (
      <Entry key={a.id} id={a.id} name={a.n} price={a.p} hidden={!!a.hidden} open={open === a.id} toggle={() => toggle(a.id)}
        meta={`кін ${a.kin} · кисл ${a.acid} · вог ${a.fire} · ел ${a.elec} · рад ${a.rad} · ${kg(a.w)} кг`}
        setHidden={v => updArmor(a.id, x => { if (v) x.hidden = true; else delete x.hidden; })} remove={() => remove("armors", a.id)}>
        <ArmorFields a={a} set={fn => updArmor(a.id, fn)} />
      </Entry>
    ));
  }
  const empty = !cat[kind].length ? "Тут поки порожньо." : q.trim() ? "Нічого не знайдено." : "";

  return (
    <div className="sc-gm">
      <header className="top">
        <div className="who"><h1>Меню майстра</h1><div className="sub">Каталог, з якого гравці беруть речі</div></div>
        <div className="top-r">
          <span className={cx("sync", st.catalogSync === "err" && "s-err", st.catalogSync === "saving" && "s-saving")} style={{ visibility: status ? "visible" : "hidden" }}>{status || "·"}</span>
          <Btn sm className="ib" onClick={() => navigate({ name: "roster" })}><IconPeople />Персонажі</Btn>
        </div>
      </header>
      <nav className="tabs gmtabs" aria-label="Розділи каталогу">
        {KINDS.map(([k, n]) => (
          <button type="button" key={k} className={cx("tab", kind === k && "on")} aria-current={kind === k ? "page" : undefined} onClick={() => { setKind(k); setOpen(""); }}>
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
      <div className="gmfoot">
        <Confirm sm={false} label="Повернути стандартний каталог" ask="Точно? Усі зміни каталогу зникнуть" title="Повернути стандартний каталог"
          onConfirm={() => { camp.updateCatalog(() => structuredClone(DEFAULT_CATALOG)); setOpen(""); }} />
      </div>
    </div>
  );
}

/** One catalogue entry: name, numbers and price; «Змінити» opens its fields, hiding and deleting. */
function Entry({ id, name, meta, extra, price, hidden, open, toggle, setHidden, remove, children }: {
  id: string; name: string; meta: string; extra?: string; price: number; hidden: boolean; open: boolean;
  toggle: () => void; setHidden: (v: boolean) => void; remove: () => void; children: ReactNode;
}) {
  return (
    <div className={cx("card", hidden && "hid")} id={"cat-" + id}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <b style={{ overflowWrap: "anywhere" }}>{name}{hidden && <span className="chip tagc">приховано</span>}</b>
          {meta && <span className="hint num">{meta}</span>}
          {extra && <span className="hint">{extra}</span>}
        </div>
        <div className="row" style={{ flex: "none" }}>
          <span className="hint num" style={{ whiteSpace: "nowrap" }}>{price ? `${price} куп.` : "без ціни"}</span>
          <Btn sm pri={open} onClick={toggle}>{open ? "Готово" : "Змінити"}</Btn>
        </div>
      </div>
      {open && <>
        {children}
        <div className="row between wrapg">
          <Check checked={hidden} set={setHidden}>Приховано від гравців</Check>
          <Confirm sm={false} label="Видалити з каталогу" ask="Точно видалити?" title="Видалити з каталогу" onConfirm={remove} />
        </div>
      </>}
    </div>
  );
}

function GunFields({ g, set }: { g: CatGun; set: (fn: (x: CatGun) => void) => void }) {
  const [mod, setMod] = useState<ModKind>("optic");
  const mods = g.mods ?? [];
  const groups = GUN_GROUPS.includes(g.g) ? GUN_GROUPS : [...GUN_GROUPS, g.g];
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={g.n} set={v => set(x => { x.n = v; })} /></Lab>
      <Lab name="Група"><select className="in" value={g.g} onChange={e => set(x => { x.g = e.target.value; })}>{groups.map(n => <option key={n} value={n}>{n}</option>)}</select></Lab>
      <Lab name="Навичка"><select className="in" value={g.skill} onChange={e => set(x => { x.skill = e.target.value as SkillKey; })}>{WEAPON_SKILLS.map(k => <option key={k} value={k}>{SKILL_NAME[k]}</option>)}</select></Lab>
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

function ItemFields({ m, set }: { m: CatItem; set: (fn: (x: CatItem) => void) => void }) {
  return (
    <div className="fgrid">
      <Check wide checked={!!m.ammo} set={v => set(x => {
        if (v) { x.ammo = true; x.cal = x.cal || ""; x.pack = x.pack || 30; delete x.n; delete x.w; }
        else { delete x.ammo; delete x.cal; delete x.pack; x.n = x.n || "Нова річ"; x.w = x.w ?? 0; }
      })}>Набої: назва складається з калібру й кількості</Check>
      {m.ammo ? <>
        <Lab name="Калібр"><Text value={m.cal ?? ""} placeholder="5.45×39" set={v => set(x => { x.cal = v; })} /></Lab>
        <Lab name="Набоїв у пачці"><NumIn value={m.pack ?? 1} min={1} set={v => set(x => { x.pack = Math.max(1, Math.round(v)); })} /></Lab>
      </> : <>
        <Lab name="Назва" wide><Text value={m.n ?? ""} set={v => set(x => { x.n = v; })} /></Lab>
        <Lab name="Вага однієї, кг"><NumIn value={m.w ?? 0} set={v => set(x => { x.w = v; })} /></Lab>
      </>}
      <Lab name="Група"><input className="in" list="cat-groups" value={m.g} onChange={e => set(x => { x.g = e.target.value; })} /></Lab>
      <Lab name="Ціна, куп."><NumIn value={m.p} set={v => set(x => { x.p = Math.round(v); })} /></Lab>
      <Lab name="Використань у наборі"><NumIn value={m.uses ?? 0} set={v => set(x => { if (v > 0) x.uses = Math.round(v); else delete x.uses; })} /></Lab>
      <Lab name="Дія кнопки «Вжити»">
        <select className="in" value={m.fx ?? ""} onChange={e => set(x => { if (e.target.value) x.fx = e.target.value as ItemEffect; else delete x.fx; })}>
          {ITEM_FX.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Lab>
      <Lab name="Опис" wide><Text value={m.d ?? ""} set={v => set(x => { if (v) x.d = v; else delete x.d; })} /></Lab>
    </div>
  );
}

function ArmorFields({ a, set }: { a: CatArmor; set: (fn: (x: CatArmor) => void) => void }) {
  const field = (name: string, key: "kin" | "acid" | "fire" | "elec" | "rad" | "w" | "slots" | "p") =>
    <Lab name={name}><NumIn value={a[key]} set={v => set(x => { x[key] = key === "w" ? v : Math.round(v); })} /></Lab>;
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={a.n} set={v => set(x => { x.n = v; })} /></Lab>
      {field("Кінетика", "kin")}{field("Кислота", "acid")}{field("Вогонь", "fire")}{field("Електрика", "elec")}{field("Радіація", "rad")}
      {field("Вага, кг", "w")}{field("Контейнери", "slots")}{field("Ціна, куп.", "p")}
    </div>
  );
}
