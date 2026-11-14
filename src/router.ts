// Addresses for the screens, on the History API without a library:
//   /               the roster (home after sign-in)
//   /new            creating a character
//   /gm             the GM's menu: the catalogue
//   /c/{id}         a sheet on «Картка»
//   /c/{id}/{tab}   a sheet on another tab: combat, pack or notes
// Firebase Hosting and the Vite dev server both answer every path with index.html.
import { useMemo, useSyncExternalStore } from "react";

export const SHEET_TABS = ["sheet", "combat", "pack", "notes"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

export type Route =
  | { name: "roster" }
  | { name: "new" }
  | { name: "gm" }
  | { name: "sheet"; id: string; tab: SheetTab };

export function parseRoute(path: string): Route {
  const p = path.split("/").filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch { return s; } });
  if (p.length === 1 && p[0] === "new") return { name: "new" };
  if (p.length === 1 && p[0] === "gm") return { name: "gm" };
  if (p[0] === "c" && p[1] && p.length <= 3) {
    const tab = (SHEET_TABS as readonly string[]).includes(p[2] ?? "") ? (p[2] as SheetTab) : "sheet";
    return { name: "sheet", id: p[1], tab };
  }
  return { name: "roster" };
}

export function routePath(r: Route): string {
  if (r.name === "new") return "/new";
  if (r.name === "gm") return "/gm";
  if (r.name === "sheet") return `/c/${encodeURIComponent(r.id)}${r.tab === "sheet" ? "" : "/" + r.tab}`;
  return "/";
}

const listeners = new Set<() => void>();
function subscribe(f: () => void) {
  listeners.add(f);
  window.addEventListener("popstate", f);
  return () => { listeners.delete(f); window.removeEventListener("popstate", f); };
}

/** Goes to a screen. `replace` changes the address without a new step for the browser's Back button (tabs, redirects). */
export function navigate(r: Route, replace = false) {
  const url = routePath(r) + location.search; // the query keeps ?demo during development
  if (url !== location.pathname + location.search) history[replace ? "replaceState" : "pushState"](null, "", url);
  listeners.forEach(f => f());
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, () => location.pathname);
  return useMemo(() => parseRoute(path), [path]);
}
