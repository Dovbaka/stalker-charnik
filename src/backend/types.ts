import type { Catalog } from "../rules/catalog";
import type { Character } from "../rules/types";

export interface User { uid: string; name: string }

/** A sheet document as stored in `chars/{id}`. */
export interface CharDoc {
  owner: string;
  ownerName: string;
  /** id of the browser tab that wrote it last, so a tab can recognise its own echo */
  by: string;
  updatedAt: number;
  char: Character;
}
export interface RemoteChar extends Partial<CharDoc> {
  id: string;
  /** true while this is the tab's own write that the server has not confirmed yet */
  pending: boolean;
}
/** Some fields of a sheet. Only these are written, so what another writer changed meanwhile survives. */
export interface CharPatch { by: string; updatedAt: number; char: Partial<Character> }

/** Everything the app needs from a server. Firebase in production, memory in development and tests. */
export interface Backend {
  onAuth(cb: (user: User | null) => void): () => void;
  /** rejects with `{ code }` in Firebase Auth's vocabulary */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  watchChars(cb: (docs: RemoteChar[], fromCache: boolean) => void, onError: (code: string) => void): () => void;
  newCharId(): string;
  /** writes a new sheet whole */
  saveChar(id: string, doc: CharDoc): Promise<void>;
  /** changes named fields of an existing sheet */
  patchChar(id: string, patch: CharPatch): Promise<void>;
  deleteChar(id: string): Promise<void>;
  /** private notes of one sheet: null when there are none yet */
  watchSecret(uid: string, charId: string, cb: (text: string | null) => void): () => void;
  getSecret(uid: string, charId: string): Promise<string | null>;
  saveSecret(uid: string, charId: string, text: string): Promise<void>;
  deleteSecret(uid: string, charId: string): Promise<void>;
  /** the GM's catalogue as stored: null until the GM first saves it */
  watchCatalog(cb: (raw: unknown) => void): () => void;
  saveCatalog(cat: Catalog): Promise<void>;
}
