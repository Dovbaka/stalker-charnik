import { useCallback, useEffect, useMemo, useState } from "react";
import { derive, type Derived } from "../rules/character";
import type { Character } from "../rules/types";
import { useCampaign } from "../state/context";
import { cx } from "../util";
import { Btn, usePersistedString } from "./bits";
import { CardTab } from "./sheet/CardTab";
import { CombatTab } from "./sheet/CombatTab";
import { NotesTab } from "./sheet/NotesTab";
import { PackTab } from "./sheet/PackTab";
import { RestDialog } from "./sheet/RestDialog";

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

export function Sheet({ id, menu }: { id: string; menu: () => void }) {
  const [st, camp] = useCampaign();
  const c = camp.charOf(id);
  const own = camp.isMine(id);
  const [tab, setTab] = usePersistedString("charnik.tab", "sheet");
  const [edit, setEdit] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [resting, setResting] = useState(false);
  const closeRest = useCallback(() => setResting(false), []);
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
  // Saving is quiet; only a problem is worth a word.
  const status = !own ? "Лише перегляд" : st.sync === "err" ? "Не збережено" : st.sync === "saving" && !online ? "Без мережі, збережеться потім" : "";

  return (
    <div className={cx("sc-sheet", !own && "ro")}>
      <header className="top">
        <div className="who">
          <h1>{c.id.callsign || "Без позивного"}</h1>
          {!own && <div className="sub">гравець {owner}</div>}
        </div>
        <div className="top-r">
          <span className={`stamp l${d.level}`}>{d.label}</span>
          <div className="row wrapg" style={{ justifyContent: "flex-end" }}>
            {status && <span className={cx("sync", own && st.sync === "err" && "s-err", own && st.sync === "saving" && "s-saving")}>{status}</span>}
            <Btn sm onClick={menu}>Персонажі</Btn>
            {own && <Btn sm onClick={() => setResting(true)}>Відпочити</Btn>}
            {own && <Btn sm pri={edit} onClick={() => setEdit(!edit)}>{edit ? "Готово" : "Правити"}</Btn>}
          </div>
        </div>
      </header>
      <nav className="tabs toptabs" aria-label="Розділи">{tabs}</nav>
      <main className="grid">
        {current === "sheet" && <CardTab {...api} />}
        {current === "combat" && <CombatTab {...api} />}
        {current === "pack" && <PackTab {...api} />}
        {current === "notes" && <NotesTab {...api} />}
      </main>
      <nav className="navb" aria-label="Розділи">{tabs}</nav>
      {resting && own && <RestDialog {...api} close={closeRest} />}
    </div>
  );
}
