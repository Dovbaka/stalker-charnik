import { createContext, useContext, useSyncExternalStore } from "react";
import type { Campaign, CampaignState } from "./campaign";

export const CampaignContext = createContext<Campaign | null>(null);

/** The campaign's state, re-rendering the caller whenever it changes, and the object that changes it. */
export function useCampaign(): [CampaignState, Campaign] {
  const camp = useContext(CampaignContext);
  if (!camp) throw new Error("CampaignContext is missing");
  return [useSyncExternalStore(camp.subscribe, camp.get), camp];
}
