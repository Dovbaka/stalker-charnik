import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Backend } from "./backend/types";
import { Campaign } from "./state/campaign";
import { CampaignContext } from "./state/context";
import { Toaster, toast } from "./ui/bits";
import "./styles.css";

async function setup(): Promise<{ be: Backend; gms?: readonly string[] }> {
  // `npm run dev` with ?demo in the address runs on an in-memory server: no Google sign-in, nothing saved.
  // ?demo&gm signs in as the GM.
  const q = new URLSearchParams(location.search);
  if (import.meta.env.DEV && q.has("demo")) {
    const { memoryBackend } = await import("./backend/memory");
    const gms = q.has("gm") ? ["demo-me"] : [];
    return { be: memoryBackend({ seed: true, gms }), gms };
  }
  const { firebaseBackend } = await import("./backend/firebase");
  return { be: firebaseBackend() };
}

setup().then(({ be, gms }) => {
  const campaign = new Campaign(be, toast, gms);
  campaign.start();
  createRoot(document.getElementById("app")!).render(
    <StrictMode>
      <CampaignContext.Provider value={campaign}>
        <App />
        <Toaster />
      </CampaignContext.Provider>
    </StrictMode>,
  );
});
