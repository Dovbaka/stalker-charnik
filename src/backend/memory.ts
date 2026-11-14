// An in-memory stand-in for Firebase: local development (`?demo` in the address) and tests.
import { blankCharacter, maxHp } from "../rules/character";
import { GM_FIELDS } from "../roles";
import type { Backend, CharDoc, RemoteChar, User } from "./types";

export interface MemoryBackend extends Backend {
  /** test hooks */
  docs: Map<string, CharDoc>;
  secrets: Map<string, string>;
  writeAs(id: string, doc: CharDoc): void;
}

/** `gms` plays the part of the GM list in firestore.rules. */
export function memoryBackend(opts: { user?: User | null; seed?: boolean; gms?: readonly string[] } = {}): MemoryBackend {
  const me: User = opts.user ?? { uid: "demo-me", name: "Демо-гравець" };
  const docs = new Map<string, CharDoc>();
  const secrets = new Map<string, string>();
  const charSubs = new Set<(docs: RemoteChar[], fromCache: boolean) => void>();
  const authSubs = new Set<(u: User | null) => void>();
  const secretSubs = new Map<string, Set<(t: string | null) => void>>();
  let current: User | null = opts.user === null ? null : null;
  let catalog: unknown = null;
  const catSubs = new Set<(raw: unknown) => void>();
  const isGM = () => !!current && (opts.gms ?? []).includes(current.uid);
  let seq = 0;

  if (opts.seed) {
    const c = blankCharacter();
    Object.assign(c.id, { callsign: "Док", role: "Науковиця", age: "34" });
    Object.assign(c.attrs, { spr: 2, til: 3, spy: 4, rea: 2, mud: 5 });
    Object.assign(c.skills, { medicine: 4, science: 3 });
    c.hp = maxHp(c) - 8; c.rad = 140; c.cid = "demo-other";
    docs.set("demo-other", { owner: "demo-other-user", ownerName: "Інший гравець", by: "seed", updatedAt: 1, char: c });
  }

  const emit = () => { const list: RemoteChar[] = [...docs].map(([id, d]) => ({ ...structuredClone(d), id, pending: false })); charSubs.forEach(cb => cb(list, false)); };
  const later = (fn: () => void) => { queueMicrotask(fn); };
  const key = (uid: string, id: string) => uid + "/" + id;

  return {
    docs, secrets,
    writeAs(id, doc) { docs.set(id, structuredClone(doc)); emit(); },
    onAuth(cb) { authSubs.add(cb); later(() => cb(current)); return () => { authSubs.delete(cb); }; },
    async signIn() { current = me; authSubs.forEach(cb => cb(current)); },
    async signOut() { current = null; authSubs.forEach(cb => cb(null)); },
    watchChars(cb) { charSubs.add(cb); later(emit); return () => { charSubs.delete(cb); }; },
    newCharId: () => "mem" + ++seq,
    async saveChar(id, doc) {
      const old = docs.get(id);
      if (!current || doc.owner !== current.uid || (old && old.owner !== current.uid)) throw { code: "permission-denied" };
      docs.set(id, structuredClone(doc)); emit();
    },
    async patchChar(id, p) {
      const old = docs.get(id);
      if (!current || !old) throw { code: "permission-denied" };
      // the same test as firestore.rules: the owner changes anything, the GM only the listed fields
      if (old.owner !== current.uid && !(isGM() && Object.keys(p.char).every(k => GM_FIELDS.includes(k)))) throw { code: "permission-denied" };
      docs.set(id, structuredClone({ ...old, by: p.by, updatedAt: p.updatedAt, char: { ...old.char, ...p.char } })); emit();
    },
    async deleteChar(id) {
      const old = docs.get(id);
      if (!current || (old && old.owner !== current.uid)) throw { code: "permission-denied" };
      docs.delete(id); emit();
    },
    watchSecret(uid, id, cb) {
      const k = key(uid, id);
      if (!secretSubs.has(k)) secretSubs.set(k, new Set());
      secretSubs.get(k)!.add(cb);
      later(() => cb(secrets.has(k) ? secrets.get(k)! : null));
      return () => { secretSubs.get(k)?.delete(cb); };
    },
    async getSecret(uid, id) { const k = key(uid, id); return secrets.has(k) ? secrets.get(k)! : null; },
    async saveSecret(uid, id, text) { secrets.set(key(uid, id), text); },
    async deleteSecret(uid, id) { secrets.delete(key(uid, id)); },
    watchCatalog(cb) { catSubs.add(cb); later(() => cb(structuredClone(catalog))); return () => { catSubs.delete(cb); }; },
    async saveCatalog(cat) {
      if (!isGM()) throw { code: "permission-denied" };
      catalog = structuredClone(cat); catSubs.forEach(cb => cb(structuredClone(catalog)));
    },
  };
}
