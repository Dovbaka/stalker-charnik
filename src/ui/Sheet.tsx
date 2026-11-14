import { useCallback, useEffect, useMemo, useState } from "react";
import { derive, type Derived } from "../rules/character";
import type { Character } from "../rules/types";
import type { Undo } from "../state/campaign";
import { useCampaign } from "../state/context";
import { cx } from "../util";
import { navigate, type SheetTab } from "../router";
import { Btn, IconCheck, IconFire, IconPencil, IconPeople } from "./bits";
import { CardTab } from "./sheet/CardTab";
import { CombatTab } from "./sheet/CombatTab";
import { NotesTab } from "./sheet/NotesTab";
import { PackTab } from "./sheet/PackTab";
import { RestDialog } from "./sheet/RestDialog";

/** What every box of the sheet gets. */
export interface SheetApi {
  c: Character;
  d: Derived;
  /** nothing in this box can be changed: someone else's sheet, or a part of it the GM does not touch */
  ro: boolean;
  /** the GM on another player's sheet: health, radiation, conditions and gear are open, the rest is read-only */
  gm: boolean;
  /** «Редагувати» is on: base numbers and names are editable */
  edit: boolean;
  /** change the sheet; the recipe mutates a draft. Returns what puts the change back, for «Скасувати». */
  up: (recipe: (c: Character) => void) => Undo | null;
}

const TABS: [SheetTab, string][] = [["sheet", "Картка"], ["combat", "Бій"], ["pack", "Рюкзак"], ["notes", "Нотатки"]];

/** One sheet. The tab comes from the address, so a reload or a shared link opens the same place. */
export function Sheet({ id, tab }: { id: string; tab: SheetTab }) {
  const [st, camp] = useCampaign();
  const c = camp.charOf(id);
  const own = camp.isMine(id);
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
  // the browser tab and its history show whose sheet this is
  const callsign = c?.id.callsign || "Без позивного";
  useEffect(() => {
    document.title = `${callsign} · S.T.A.L.K.E.R. TTRPG`;
    return () => { document.title = "S.T.A.L.K.E.R. TTRPG"; };
  }, [callsign]);

  if (!c || !d) return null;
  const gm = !own && st.gm;
  const api: SheetApi = { c, d, ro: !own && !gm, gm, edit: own && edit, up: fn => camp.update(id, fn) };
  const owner = st.entries[id]?.ownerName ?? "";
  const current = tab;
  // switching tabs replaces the address: Back leaves the sheet instead of walking through its tabs
  const tabs = TABS.map(([k, n]) => (
    <button type="button" key={k} className={cx("tab", current === k && "on")} aria-current={current === k ? "page" : undefined} onClick={() => navigate({ name: "sheet", id, tab: k }, true)}>{n}</button>
  ));
  // Saving is quiet; only a problem is worth a word.
  const status = !own && !gm ? "Лише перегляд" : st.sync === "err" ? "Не збережено" : st.sync === "saving" && !online ? "Без мережі, збережеться потім" : gm ? "Майстер" : "";

  return (
    <div className={cx("sc-sheet", !own && !gm && "ro")}>
      <header className="top">
        <div className="who">
          <h1>{c.id.callsign || "Без позивного"}</h1>
          {!own && <div className="sub">гравець {owner}</div>}
        </div>
        <div className="top-r">
          <span className={`stamp l${d.level}`}>{d.label}</span>
          <div className="row wrapg" style={{ justifyContent: "flex-end" }}>
            {status && <span className={cx("sync", !api.ro && st.sync === "err" && "s-err", !api.ro && st.sync === "saving" && "s-saving")}>{status}</span>}
            <Btn sm className="ib" onClick={() => navigate({ name: "roster" })}><IconPeople />Персонажі</Btn>
            {own && <Btn sm className="ib" onClick={() => setResting(true)}><IconFire />Відпочити</Btn>}
            {own && <Btn sm pri={edit} className="ib" onClick={() => setEdit(!edit)}>{edit ? <><IconCheck />Готово</> : <><IconPencil />Редагувати</>}</Btn>}
          </div>
        </div>
      </header>
      <nav className="tabs toptabs" aria-label="Розділи">{tabs}</nav>
      <main className="cols">
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
