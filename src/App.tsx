import { produce } from "immer";
import { useEffect, useRef, useState } from "react";
import { finishDraft, migrate, newDraft, type Draft } from "./rules/character";
import { useCampaign } from "./state/context";
import { Login } from "./ui/Login";
import { Roster } from "./ui/Roster";
import { Sheet } from "./ui/Sheet";
import { Wizard } from "./ui/Wizard";
import { toast } from "./ui/bits";

const LS_DRAFT = "charnik.draft", LS_ACTIVE = "charnik.active";

function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(LS_DRAFT) || "null");
    if (!d || !d.d) return null;
    return { step: Number(d.step) || 0, d: migrate(d.d), cart: { m: d.cart?.m ?? {}, g: d.cart?.g ?? {} }, ab: { name: String(d.ab?.name ?? ""), text: String(d.ab?.text ?? "") } };
  } catch { return null; }
}
const store = (key: string, value: string | null) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private window */ } };

type Screen = "roster" | "wizard" | "sheet";

export function App() {
  const [st, camp] = useCampaign();
  const [screen, setScreen] = useState<Screen>("roster");
  const [active, setActive] = useState<string | null>(() => { try { return localStorage.getItem(LS_ACTIVE); } catch { return null; } });
  const [draft, setDraftState] = useState<Draft | null>(loadDraft);
  const resumed = useRef(false);

  const setDraft = (d: Draft | null) => setDraftState(d);
  // changes are applied to the latest draft, so several of them in one tick all land
  const changeDraft = (fn: (w: Draft) => void) => setDraftState(prev => (prev ? produce(prev, fn) : prev));
  useEffect(() => { store(LS_DRAFT, draft ? JSON.stringify(draft) : null); }, [draft]);
  const go = (s: Screen) => { setScreen(s); window.scrollTo(0, 0); };
  const open = (id: string) => { setActive(id); store(LS_ACTIVE, id); go("sheet"); };

  // On the first load after sign-in, return to the sheet that was open last time.
  useEffect(() => {
    if (resumed.current || !st.user || !st.loaded) return;
    resumed.current = true;
    if (active && camp.charOf(active)) setScreen("sheet");
  }, [st.user, st.loaded, active, camp]);
  useEffect(() => { if (!st.user) { resumed.current = false; setScreen("roster"); } }, [st.user]);

  if (!st.user) return <Login />;

  if (screen === "wizard" && draft) {
    return (
      <Wizard
        draft={draft}
        change={changeDraft}
        cancel={() => { setDraft(null); go("roster"); }}
        finish={() => {
          const id = camp.create(finishDraft(draft));
          setDraft(null);
          if (id) { open(id); toast("Картку створено."); } else go("roster");
        }}
      />
    );
  }

  const char = active ? camp.charOf(active) : null;
  if (screen === "sheet" && active && char) return <Sheet key={active} id={active} menu={() => go("roster")} />;

  return (
    <Roster
      open={open}
      hasDraft={!!draft}
      startWizard={fresh => { if (fresh || !draft) setDraft(newDraft()); go("wizard"); }}
    />
  );
}
