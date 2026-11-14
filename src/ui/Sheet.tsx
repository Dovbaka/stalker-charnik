import { useEffect, useMemo, useState } from "react";
import { derive, type Derived } from "../rules/character";
import type { Character } from "../rules/types";
import { useCampaign } from "../state/context";
import { cx, fmt } from "../util";
import { Bar, Btn, Trefoil, usePersistedString } from "./bits";
import { CardTab } from "./sheet/CardTab";
import { CombatTab } from "./sheet/CombatTab";
import { NotesTab } from "./sheet/NotesTab";
import { PackTab } from "./sheet/PackTab";

/** What every box of the sheet gets. */
export interface SheetApi {
  c: Character;
  d: Derived;
  /** someone else's sheet: nothing can be changed */
  ro: boolean;
  /** "Правити" is on: base numbers and names are editable */
  edit: boolean;
  /** change the sheet; the recipe mutates a draft */
  up: (recipe: (c: Character) => void) => void;
}

const TABS: [string, string][] = [["sheet", "Картка"], ["combat", "Бій"], ["pack", "Рюкзак"], ["notes", "Нотатки"]];
const SYNC = { ok: "Збережено", saving: "Зберігаю", err: "Не збережено" };

export function Sheet({ id, menu }: { id: string; menu: () => void }) {
  const [st, camp] = useCampaign();
  const c = camp.charOf(id);
  const own = camp.isMine(id);
  const [tab, setTab] = usePersistedString("charnik.tab", "sheet");
  const [edit, setEdit] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const d = useMemo(() => (c ? derive(c) : null), [c]);

  useEffect(() => { if (!own) return; camp.openSecret(id); return () => camp.closeSecret(); }, [camp, id, own]);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    window.addEventListener("online", f); window.addEventListener("offline", f);
    return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);

  if (!c || !d) return null;
  const api: SheetApi = { c, d, ro: !own, edit: own && edit, up: fn => camp.update(id, fn) };
  const owner = st.entries[id]?.ownerName ?? "";
  const current = TABS.some(t => t[0] === tab) ? tab : "sheet";
  const tabs = TABS.map(([k, n]) => (
    <button type="button" key={k} className={cx("tab", current === k && "on")} aria-current={current === k ? "page" : undefined} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>{n}</button>
  ));
  const status = st.sync === "saving" && !online ? "Без мережі, збережеться потім" : SYNC[st.sync];

  return (
    <div className={cx("sc-sheet", !own && "ro")}>
      <header className="top">
        <div className="who">
          <div className="formno">Облікова картка сталкера{own ? "" : " · гравець " + owner}</div>
          <h1>«{c.id.callsign || "Без позивного"}»</h1>
          <div className="sub">{[c.id.role, c.id.age ? c.id.age + " р." : ""].filter(Boolean).join(", ")}</div>
        </div>
        <div className="top-r">
          <span className={`stamp st-${d.hpCls}`}>{d.label}</span>
          <span className={`sync s-${own ? st.sync : "ro"}`}>{own ? status : "Лише перегляд"}</span>
          <div className="row">
            <Btn sm onClick={menu}>Персонажі</Btn>
            {own && <Btn sm pri={edit} onClick={() => setEdit(!edit)}>{edit ? "Готово" : "Правити"}</Btn>}
          </div>
        </div>
      </header>
      <div className="stick">
        <div className="vit num">
          <span><b>{c.hp}</b>/{d.max} ОЗ</span>
          <Bar mini pct={(c.hp / d.max) * 100} cls={d.hpCls} />
          <span className="amber"><Trefoil /><span><b>{c.rad}</b> рад</span></span>
          <span><b>{fmt(c.money)}</b> куп.</span>
          {d.checkPen !== 0 && <span className="neg">{d.checkPen} до перевірок</span>}
        </div>
        <nav className="tabs" aria-label="Розділи">{tabs}</nav>
      </div>
      <main className="grid">
        {current === "sheet" && <CardTab {...api} />}
        {current === "combat" && <CombatTab {...api} />}
        {current === "pack" && <PackTab {...api} />}
        {current === "notes" && <NotesTab {...api} />}
      </main>
      <nav className="navb" aria-label="Розділи">{tabs}</nav>
    </div>
  );
}
