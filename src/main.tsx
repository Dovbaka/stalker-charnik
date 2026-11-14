import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Backend } from "./backend/types";
import { Campaign } from "./state/campaign";
import { CampaignContext } from "./state/context";
import { Toaster, toast } from "./ui/bits";
import "./styles.css";

async function backend(): Promise<Backend> {
  // `npm run dev` with ?demo in the address runs on an in-memory server: no Google sign-in, nothing saved.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
    const { memoryBackend } = await import("./backend/memory");
    return memoryBackend({ seed: true });
  }
  const { firebaseBackend } = await import("./backend/firebase");
  return firebaseBackend();
}

backend().then(be => {
  const campaign = new Campaign(be, toast);
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
