import { produce } from "immer";
import { useEffect, useState } from "react";
import { finishDraft, migrate, newDraft, type Draft } from "./rules/character";
import { navigate, useRoute } from "./router";
import { useCampaign } from "./state/context";
import { Login } from "./ui/Login";
import { Roster } from "./ui/Roster";
import { Sheet } from "./ui/Sheet";
import { Wizard } from "./ui/Wizard";
import { toast } from "./ui/bits";

const LS_DRAFT = "charnik.draft";

function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(LS_DRAFT) || "null");
    if (!d || !d.d) return null;
    return { step: Number(d.step) || 0, d: migrate(d.d), cart: { m: d.cart?.m ?? {}, g: d.cart?.g ?? {} }, ab: { name: String(d.ab?.name ?? ""), text: String(d.ab?.text ?? "") } };
  } catch { return null; }
}
const store = (key: string, value: string | null) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private window */ } };

/** Signed out, every address shows the sign-in page; signed in, the address picks the screen (see router.ts). */
export function App() {
  const [st, camp] = useCampaign();
  const route = useRoute();
  const [draft, setDraftState] = useState<Draft | null>(loadDraft);

  const setDraft = (d: Draft | null) => setDraftState(d);
  // changes are applied to the latest draft, so several of them in one tick all land
  const changeDraft = (fn: (w: Draft) => void) => setDraftState(prev => (prev ? produce(prev, fn) : prev));
  useEffect(() => { store(LS_DRAFT, draft ? JSON.stringify(draft) : null); }, [draft]);

  // /new without a draft in progress starts a fresh one
  const needDraft = !!st.user && route.name === "new" && !draft;
  useEffect(() => { if (needDraft) setDraftState(newDraft()); }, [needDraft]);
  // a sheet that is not in the base (deleted, or a mistyped address) leads back to the roster
  const missing = !!st.user && st.loaded && route.name === "sheet" && !camp.charOf(route.id);
  useEffect(() => { if (missing) { toast("Такої картки немає."); navigate({ name: "roster" }, true); } }, [missing]);

  if (!st.user) return <Login />;

  if (route.name === "new") {
    if (!draft) return null;
    return (
      <Wizard
        draft={draft}
        change={changeDraft}
        // leaving the wizard replaces its address, so Back does not return to an empty form
        cancel={() => { navigate({ name: "roster" }, true); setDraft(null); }}
        finish={() => {
          const id = camp.create(finishDraft(draft));
          navigate(id ? { name: "sheet", id, tab: "sheet" } : { name: "roster" }, true);
          setDraft(null);
          if (id) toast("Картку створено.");
        }}
      />
    );
  }

  if (route.name === "sheet") {
    if (!camp.charOf(route.id)) return null; // still loading, or about to go back to the roster
    return <Sheet key={route.id} id={route.id} tab={route.tab} />;
  }

  return (
    <Roster
      open={id => navigate({ name: "sheet", id, tab: "sheet" })}
      hasDraft={!!draft}
      startWizard={fresh => { if (fresh || !draft) setDraft(newDraft()); navigate({ name: "new" }); }}
    />
  );
}
