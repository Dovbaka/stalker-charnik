// The app's state outside React: who is signed in, every sheet of the campaign, the sheets I may change,
// the GM's catalogue, and for the GM alone the NPC compendium and the encounters. Components read it through `useCampaign()`; tests drive it with the memory backend.
//
// Saving: a sheet is sent 0.9 s after the last change, and only the fields that differ from the server's copy.
// When the GM and the player change one sheet at the same time, each keeps the other's fields:
// news from the server replaces every field except the ones changed here and not saved yet.
import { produce } from "immer";
import type { Backend, RemoteChar, User } from "../backend/types";
import { GM_UIDS } from "../roles";
import { DEFAULT_CATALOG, readCatalog, type Catalog } from "../rules/catalog";
import { migrate } from "../rules/character";
import { newEncounter, readEncounter, readNpcs, type Encounter, type NpcEntry } from "../rules/npc";
import type { Character } from "../rules/types";
import { uid } from "../util";

export interface Entry {
  id: string;
  owner: string;
  ownerName: string;
  updatedAt: number;
  /** the sheet as the server has it */
  char: Character;
}
export type Sync = "ok" | "saving" | "err";
export interface CampaignState {
  authReady: boolean;
  user: User | null;
  /** the signed-in person is the GM: may change other players' health and gear, and the catalogue */
  gm: boolean;
  /** the first answer about sheets has arrived */
  loaded: boolean;
  error: string;
  entries: Record<string, Entry>;
  /** the sheets I may change, as I see them: ahead of the server while a save is on its way */
  mine: Record<string, Character>;
  sync: Sync;
  /** private notes of the sheet that is open */
  secret: { id: string | null; ready: boolean; text: string };
  /** the GM's catalogue, or the built-in one until the GM first saves */
  catalog: Catalog;
  catalogSync: Sync;
  /** the GM's NPC compendium; empty for players, who cannot read it */
  npcs: NpcEntry[];
  npcSync: Sync;
  /** the GM's encounters by id */
  encounters: Record<string, Encounter>;
  encLoaded: boolean;
  encSync: Sync;
}
/** Puts back what one change did. */
export type Undo = () => void;
export type Notify = (message: string, undo?: Undo | null) => void;

const SAVE_DELAY = 900;
const EMPTY: CampaignState = {
  authReady: false, user: null, gm: false, loaded: false, error: "", entries: {}, mine: {}, sync: "ok",
  secret: { id: null, ready: false, text: "" }, catalog: DEFAULT_CATALOG, catalogSync: "ok",
  npcs: [], npcSync: "ok", encounters: {}, encLoaded: false, encSync: "ok",
};

/** Top-level fields of a sheet whose values differ. */
export function changedKeys(a: Character, b: Character): (keyof Character)[] {
  return (Object.keys(a) as (keyof Character)[]).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
const pick = (c: Character, keys: (keyof Character)[]): Partial<Character> => Object.fromEntries(keys.map(k => [k, c[k]]));

export class Campaign {
  private state: CampaignState = EMPTY;
  private listeners = new Set<() => void>();
  private tab = uid();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = 0;
  /** sheets created here and not written yet: the first write is the whole document */
  private fresh = new Set<string>();
  private stopChars?: () => void;
  private stopCatalog?: () => void;
  private stopSecret?: () => void;
  private secretTimer?: ReturnType<typeof setTimeout>;
  private secretTypedAt = 0;
  private catTimer?: ReturnType<typeof setTimeout>;
  private catInFlight = 0;
  private stopNpcs?: () => void;
  private stopEnc?: () => void;
  private npcTimer?: ReturnType<typeof setTimeout>;
  private npcInFlight = 0;
  private encTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private encInFlight = new Map<string, number>();

  constructor(private be: Backend, private notify: Notify = () => {}, private gms: readonly string[] = GM_UIDS) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  get = () => this.state;
  private set(patch: Partial<CampaignState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()); }

  /** Starts listening to the sign-in state; returns the function that stops everything. */
  start(): () => void {
    const stopAuth = this.be.onAuth(user => {
      this.stopChars?.(); this.stopChars = undefined;
      this.stopCatalog?.(); this.stopCatalog = undefined;
      this.stopGm();
      this.closeSecret();
      if (!user) { this.set({ ...EMPTY, authReady: true }); return; }
      this.set({ ...EMPTY, authReady: true, user, gm: this.gms.includes(user.uid) });
      this.stopChars = this.be.watchChars(docs => this.onChars(docs), code => this.set({ loaded: true, error: code === "permission-denied" ? "База не дала доступу. Вийди й увійди ще раз." : "Немає зв'язку з базою. Перевір інтернет." }));
      this.stopCatalog = this.be.watchCatalog(raw => this.onCatalog(raw));
      if (this.state.gm) {
        this.stopNpcs = this.be.watchNpcs(raw => this.onNpcs(raw));
        this.stopEnc = this.be.watchEncounters(docs => this.onEncounters(docs));
      }
    });
    return () => { stopAuth(); this.stopChars?.(); this.stopCatalog?.(); this.stopGm(); this.closeSecret(); };
  }
  private stopGm() {
    this.stopNpcs?.(); this.stopNpcs = undefined;
    this.stopEnc?.(); this.stopEnc = undefined;
  }

  private onChars(docs: RemoteChar[]) {
    const me = this.state.user?.uid;
    const before = this.state.entries;
    const entries: Record<string, Entry> = {};
    const mine = { ...this.state.mine };
    for (const d of docs) {
      if (!d.char || !d.owner) continue;
      const char = migrate(d.char); char.cid = d.id;
      entries[d.id] = { id: d.id, owner: d.owner, ownerName: d.ownerName || "Гравець", updatedAt: d.updatedAt ?? 0, char };
      if (!me || !(d.owner === me || this.state.gm)) continue;
      const local = mine[d.id], base = before[d.id]?.char;
      if (!local || !base) { if (!local) mine[d.id] = char; continue; }
      if (d.by === this.tab) continue; // this tab's own write coming back: what is shown here is as new or newer
      // Another device or the GM changed the sheet: take their fields, keep the ones changed here and not saved yet.
      const dirty = changedKeys(local, base).filter(k => k !== "updatedAt");
      if (dirty.length) mine[d.id] = produce(char, x => { Object.assign(x, pick(local, dirty)); });
      else if (changedKeys(char, local).length) mine[d.id] = char;
    }
    for (const id of Object.keys(mine)) if (!entries[id]) delete mine[id];
    this.set({ entries, mine, loaded: true, error: "" });
  }

  isMine(id: string): boolean { const u = this.state.user; return !!u && this.state.entries[id]?.owner === u.uid; }
  /** mine, or anyone's for the GM (who may change only health and gear; the sheet shows which) */
  canEdit(id: string): boolean { return this.isMine(id) || (this.state.gm && !!this.state.entries[id]); }
  charOf(id: string): Character | null { return this.state.mine[id] ?? this.state.entries[id]?.char ?? null; }

  signIn() { return this.be.signIn(); }
  signOut() { return this.be.signOut(); }

  /**
   * Changes a sheet; the save follows after a short pause in editing.
   * Returns what puts back the fields this one change touched, or null when nothing changed.
   */
  update(id: string, recipe: (c: Character) => void): Undo | null {
    const cur = this.state.mine[id];
    if (!cur || !this.canEdit(id)) return null;
    const changed = produce(cur, recipe);
    if (changed === cur) return null;
    const next = produce(changed, c => { c.updatedAt = Date.now(); });
    this.set({ mine: { ...this.state.mine, [id]: next }, sync: "saving" });
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.flush(id), SAVE_DELAY));
    const keys = changedKeys(changed, cur);
    return () => { this.update(id, x => { Object.assign(x, pick(cur, keys)); }); };
  }

  private flush(id: string): void {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const c = this.state.mine[id], u = this.state.user, e = this.state.entries[id];
    if (!c || !u) return;
    let write: Promise<void>;
    if (this.fresh.has(id)) {
      this.fresh.delete(id);
      write = this.be.saveChar(id, { owner: u.uid, ownerName: u.name, by: this.tab, updatedAt: c.updatedAt || Date.now(), char: c });
    } else {
      const keys = e ? changedKeys(c, e.char) : [];
      if (!keys.length) { this.settle(); return; }
      write = this.be.patchChar(id, { by: this.tab, updatedAt: c.updatedAt || Date.now(), char: pick(c, keys) });
    }
    this.inFlight++;
    write.then(
      () => { this.inFlight--; this.settle(); },
      (err: { code?: string }) => {
        this.inFlight--; this.set({ sync: "err" });
        this.notify(err?.code === "permission-denied" ? "База відхилила запис: на цю картку немає прав." : "Не вдалося зберегти. Перевір інтернет.");
      });
  }
  private settle() { if (!this.inFlight && !this.timers.size && this.state.sync !== "ok") this.set({ sync: "ok" }); }

  /** Stores a new sheet as mine and returns its id. */
  create(char: Character, secret = ""): string {
    const u = this.state.user;
    if (!u) return "";
    const id = this.be.newCharId();
    const c = produce(char, d => { d.cid = id; d.updatedAt = Date.now(); if (!d.createdAt) d.createdAt = d.updatedAt; });
    this.set({
      mine: { ...this.state.mine, [id]: c },
      entries: { ...this.state.entries, [id]: { id, owner: u.uid, ownerName: u.name, updatedAt: c.updatedAt, char: c } },
      sync: "saving",
    });
    this.fresh.add(id);
    this.flush(id);
    if (secret) this.be.saveSecret(u.uid, id, secret).catch(() => {});
    return id;
  }

  remove(id: string): void {
    const u = this.state.user;
    if (!u || !this.isMine(id)) return;
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    this.be.deleteChar(id).catch(() => this.notify("Видалити не вдалося. Перевір інтернет."));
    this.be.deleteSecret(u.uid, id).catch(() => {});
  }

  /* ----- the GM's catalogue ----- */
  private onCatalog(raw: unknown) {
    if (this.catTimer || this.catInFlight) return; // the GM's own edit is on its way and is newer
    this.set({ catalog: readCatalog(raw) ?? DEFAULT_CATALOG });
  }
  /** The GM changes the catalogue; saved after a pause like a sheet. A recipe may also return a whole new catalogue. */
  updateCatalog(recipe: (c: Catalog) => Catalog | void): void {
    if (!this.state.gm) return;
    const next = produce(this.state.catalog, recipe);
    if (next === this.state.catalog) return;
    this.set({ catalog: next, catalogSync: "saving" });
    clearTimeout(this.catTimer);
    this.catTimer = setTimeout(() => this.flushCatalog(), SAVE_DELAY);
  }
  private flushCatalog(): void {
    clearTimeout(this.catTimer); this.catTimer = undefined;
    this.catInFlight++;
    this.be.saveCatalog(this.state.catalog).then(
      () => { this.catInFlight--; if (!this.catInFlight && !this.catTimer) this.set({ catalogSync: "ok" }); },
      (err: { code?: string }) => {
        this.catInFlight--; this.set({ catalogSync: "err" });
        this.notify(err?.code === "permission-denied" ? "База відхилила запис: каталог змінює лише майстер." : "Каталог не зберігся. Перевір інтернет.");
      });
  }

  /* ----- the GM's NPC compendium ----- */
  private onNpcs(raw: unknown) {
    if (this.npcTimer || this.npcInFlight) return; // the GM's own edit is on its way and is newer
    this.set({ npcs: readNpcs(raw) });
  }
  /** The GM changes the compendium; saved after a pause, like the catalogue. */
  updateNpcs(recipe: (list: NpcEntry[]) => NpcEntry[] | void): void {
    if (!this.state.gm) return;
    const next = produce(this.state.npcs, recipe);
    if (next === this.state.npcs) return;
    this.set({ npcs: next, npcSync: "saving" });
    clearTimeout(this.npcTimer);
    this.npcTimer = setTimeout(() => this.flushNpcs(), SAVE_DELAY);
  }
  private flushNpcs(): void {
    clearTimeout(this.npcTimer); this.npcTimer = undefined;
    this.npcInFlight++;
    this.be.saveNpcs(this.state.npcs).then(
      () => { this.npcInFlight--; if (!this.npcInFlight && !this.npcTimer) this.set({ npcSync: "ok" }); },
      (err: { code?: string }) => {
        this.npcInFlight--; this.set({ npcSync: "err" });
        this.notify(err?.code === "permission-denied" ? "База відхилила запис: NPC змінює лише майстер." : "NPC не збереглися. Перевір інтернет.");
      });
  }

  /* ----- the GM's encounters ----- */
  private onEncounters(docs: { id: string; data: unknown }[]) {
    const encounters: Record<string, Encounter> = {};
    for (const d of docs) {
      // an encounter with an edit of this tab on its way keeps what is shown here
      const busy = this.encTimers.has(d.id) || (this.encInFlight.get(d.id) ?? 0) > 0;
      encounters[d.id] = busy && this.state.encounters[d.id] ? this.state.encounters[d.id] : readEncounter(d.id, d.data);
    }
    for (const [id, e] of Object.entries(this.state.encounters)) if (!encounters[id] && this.encTimers.has(id)) encounters[id] = e;
    this.set({ encounters, encLoaded: true });
  }
  /** A new empty encounter, saved at once; returns its id. */
  createEncounter(name: string, from?: Encounter): string {
    if (!this.state.gm) return "";
    const id = this.be.newEncounterId();
    const e: Encounter = from ? { ...structuredClone(from), id, name, createdAt: Date.now(), updatedAt: Date.now() } : newEncounter(name, id);
    this.set({ encounters: { ...this.state.encounters, [id]: e }, encSync: "saving" });
    this.flushEncounter(id);
    return id;
  }
  /** Changes an encounter; saved after a pause. Returns what puts back the fields this change touched. */
  updateEncounter(id: string, recipe: (e: Encounter) => void): Undo | null {
    const cur = this.state.encounters[id];
    if (!this.state.gm || !cur) return null;
    const changed = produce(cur, recipe);
    if (changed === cur) return null;
    const next = produce(changed, e => { e.updatedAt = Date.now(); });
    this.set({ encounters: { ...this.state.encounters, [id]: next }, encSync: "saving" });
    clearTimeout(this.encTimers.get(id));
    this.encTimers.set(id, setTimeout(() => this.flushEncounter(id), SAVE_DELAY));
    const keys = (Object.keys(changed) as (keyof Encounter)[]).filter(k => k !== "updatedAt" && JSON.stringify(changed[k]) !== JSON.stringify(cur[k]));
    return () => { this.updateEncounter(id, e => { for (const k of keys) (e as unknown as Record<string, unknown>)[k] = structuredClone(cur[k]); }); };
  }
  private flushEncounter(id: string): void {
    clearTimeout(this.encTimers.get(id)); this.encTimers.delete(id);
    const e = this.state.encounters[id];
    if (!e) return;
    this.encInFlight.set(id, (this.encInFlight.get(id) ?? 0) + 1);
    const done = () => {
      this.encInFlight.set(id, (this.encInFlight.get(id) ?? 1) - 1);
      if (![...this.encInFlight.values()].some(n => n > 0) && !this.encTimers.size && this.state.encSync === "saving") this.set({ encSync: "ok" });
    };
    this.be.saveEncounter(e).then(done, (err: { code?: string }) => {
      done(); this.set({ encSync: "err" });
      this.notify(err?.code === "permission-denied" ? "База відхилила запис: енкаунтери веде лише майстер." : "Енкаунтер не зберігся. Перевір інтернет.");
    });
  }
  removeEncounter(id: string): void {
    if (!this.state.gm) return;
    clearTimeout(this.encTimers.get(id)); this.encTimers.delete(id);
    const { [id]: _gone, ...rest } = this.state.encounters;
    this.set({ encounters: rest });
    this.be.deleteEncounter(id).catch(() => this.notify("Видалити енкаунтер не вдалося. Перевір інтернет."));
  }

  /* ----- private notes ----- */
  openSecret(id: string): void {
    this.closeSecret();
    const u = this.state.user;
    this.set({ secret: { id, ready: false, text: "" } });
    if (!u || !this.isMine(id)) return;
    this.stopSecret = this.be.watchSecret(u.uid, id, text => {
      if (this.state.secret.id !== id) return;
      // do not pull the text from under someone who is typing
      if (this.state.secret.ready && Date.now() - this.secretTypedAt < 4000) return;
      this.set({ secret: { id, ready: true, text: text ?? "" } });
    });
  }
  closeSecret(): void {
    this.flushSecret();
    this.stopSecret?.(); this.stopSecret = undefined;
    if (this.state.secret.id) this.set({ secret: { id: null, ready: false, text: "" } });
  }
  setSecret(text: string): void {
    const s = this.state.secret;
    if (!s.id || !s.ready) return;
    this.secretTypedAt = Date.now();
    this.set({ secret: { ...s, text } });
    clearTimeout(this.secretTimer);
    this.secretTimer = setTimeout(() => this.flushSecret(), SAVE_DELAY);
  }
  private flushSecret(): void {
    if (!this.secretTimer) return;
    clearTimeout(this.secretTimer); this.secretTimer = undefined;
    const s = this.state.secret, u = this.state.user;
    if (!u || !s.id || !s.ready) return;
    this.be.saveSecret(u.uid, s.id, s.text).catch(() => this.notify("Особисті нотатки не збереглися. Перевір інтернет."));
  }

  /** A full copy for a backup code: the sheet and, unless told otherwise, its private notes. */
  async exportChar(id: string, withSecret: boolean): Promise<Record<string, unknown> | null> {
    const c = this.charOf(id), u = this.state.user;
    if (!c) return null;
    const out: Record<string, unknown> = { ...c };
    if (withSecret && u && this.isMine(id)) {
      const s = this.state.secret;
      const text = s.id === id && s.ready ? s.text : await this.be.getSecret(u.uid, id).catch(() => null);
      if (text) out.secret = text;
    }
    return out;
  }
}
