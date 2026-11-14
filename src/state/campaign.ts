// The app's state outside React: who is signed in, every sheet of the campaign, my own sheets being edited.
// Components read it through `useCampaign()`; tests drive it directly with the memory backend.
import { produce } from "immer";
import type { Backend, RemoteChar, User } from "../backend/types";
import { migrate } from "../rules/character";
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
  /** the first answer about sheets has arrived */
  loaded: boolean;
  error: string;
  entries: Record<string, Entry>;
  /** my own sheets as I see them, ahead of the server while a save is on its way */
  mine: Record<string, Character>;
  sync: Sync;
  /** private notes of the sheet that is open */
  secret: { id: string | null; ready: boolean; text: string };
}

const SAVE_DELAY = 900;
const EMPTY: CampaignState = { authReady: false, user: null, loaded: false, error: "", entries: {}, mine: {}, sync: "ok", secret: { id: null, ready: false, text: "" } };

export class Campaign {
  private state: CampaignState = EMPTY;
  private listeners = new Set<() => void>();
  private tab = uid();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = 0;
  private stopChars?: () => void;
  private stopSecret?: () => void;
  private secretTimer?: ReturnType<typeof setTimeout>;
  private secretTypedAt = 0;

  constructor(private be: Backend, private notify: (message: string) => void = () => {}) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  get = () => this.state;
  private set(patch: Partial<CampaignState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()); }

  /** Starts listening to the sign-in state; returns the function that stops everything. */
  start(): () => void {
    const stopAuth = this.be.onAuth(user => {
      this.stopChars?.(); this.stopChars = undefined;
      this.closeSecret();
      if (!user) { this.set({ ...EMPTY, authReady: true }); return; }
      this.set({ ...EMPTY, authReady: true, user });
      this.stopChars = this.be.watchChars(docs => this.onChars(docs), code => this.set({ loaded: true, error: code === "permission-denied" ? "База не дала доступу. Вийди й увійди ще раз." : "Немає зв'язку з базою. Перевір інтернет." }));
    });
    return () => { stopAuth(); this.stopChars?.(); this.closeSecret(); };
  }

  private onChars(docs: RemoteChar[]) {
    const me = this.state.user?.uid;
    const entries: Record<string, Entry> = {};
    const mine = { ...this.state.mine };
    for (const d of docs) {
      if (!d.char || !d.owner) continue;
      const char = migrate(d.char); char.cid = d.id;
      entries[d.id] = { id: d.id, owner: d.owner, ownerName: d.ownerName || "Гравець", updatedAt: d.updatedAt ?? 0, char };
      if (me && d.owner === me) {
        const local = mine[d.id];
        // take the server's copy when it is news from another device, never when it is this tab's own echo
        if (!local || (!d.pending && d.by !== this.tab && (d.updatedAt ?? 0) > (local.updatedAt ?? 0))) mine[d.id] = char;
      }
    }
    for (const id of Object.keys(mine)) if (!entries[id]) delete mine[id];
    this.set({ entries, mine, loaded: true, error: "" });
  }

  isMine(id: string): boolean { const u = this.state.user; return !!u && this.state.entries[id]?.owner === u.uid; }
  charOf(id: string): Character | null { return this.state.mine[id] ?? this.state.entries[id]?.char ?? null; }

  signIn() { return this.be.signIn(); }
  signOut() { return this.be.signOut(); }

  /** Changes one of my sheets; the save follows after a short pause in editing. */
  update(id: string, recipe: (c: Character) => void): void {
    const cur = this.state.mine[id];
    if (!cur || !this.isMine(id)) return;
    const next = produce(cur, c => { recipe(c); c.updatedAt = Date.now(); });
    this.set({ mine: { ...this.state.mine, [id]: next }, sync: "saving" });
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.flush(id), SAVE_DELAY));
  }

  private flush(id: string): void {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const c = this.state.mine[id], u = this.state.user;
    if (!c || !u) return;
    this.inFlight++;
    this.be.saveChar(id, { owner: u.uid, ownerName: u.name, by: this.tab, updatedAt: c.updatedAt || Date.now(), char: c }).then(
      () => { this.inFlight--; if (!this.inFlight && !this.timers.size) this.set({ sync: "ok" }); },
      (err: { code?: string }) => {
        this.inFlight--; this.set({ sync: "err" });
        this.notify(err?.code === "permission-denied" ? "База відхилила запис: це не твоя картка." : "Не вдалося зберегти. Перевір інтернет.");
      });
  }

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
