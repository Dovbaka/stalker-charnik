import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getFirestore, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, setDoc, type Firestore } from "firebase/firestore";
import type { Backend, CharDoc } from "./types";

// A Firebase web config is public by design: it only names the project. Access is decided by firestore.rules.
const config = {
  apiKey: "AIzaSyDKhsiI3dpmTyqxu5o-2bYCBdF0kO_sU4k",
  authDomain: "stalker-rpg-101a6.firebaseapp.com",
  projectId: "stalker-rpg-101a6",
  storageBucket: "stalker-rpg-101a6.firebasestorage.app",
  messagingSenderId: "978626005616",
  appId: "1:978626005616:web:a95c2ca37700d9ec24c2b5",
};

export function firebaseBackend(): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  let db: Firestore;
  // Offline cache: sheets open without a network and edits are sent once it returns.
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch { db = getFirestore(app); }
  const secretRef = (uid: string, charId: string) => doc(db, "users", uid, "secrets", charId);

  return {
    onAuth: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName || (u.email ?? "").split("@")[0] || "Гравець" } : null)),
    signIn: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
    signOut: () => signOut(auth),
    watchChars: (cb, onError) => onSnapshot(collection(db, "chars"),
      snap => cb(snap.docs.map(d => ({ ...(d.data() as Partial<CharDoc>), id: d.id, pending: d.metadata.hasPendingWrites })), snap.metadata.fromCache),
      err => onError(err.code)),
    newCharId: () => doc(collection(db, "chars")).id,
    saveChar: (id, data) => setDoc(doc(db, "chars", id), data),
    deleteChar: id => deleteDoc(doc(db, "chars", id)),
    watchSecret: (uid, charId, cb) => onSnapshot(secretRef(uid, charId),
      snap => { if (!snap.metadata.hasPendingWrites) cb(snap.exists() ? String(snap.data().text ?? "") : null); },
      () => cb(null)),
    getSecret: async (uid, charId) => { const snap = await getDoc(secretRef(uid, charId)); return snap.exists() ? String(snap.data().text ?? "") : null; },
    saveSecret: (uid, charId, text) => setDoc(secretRef(uid, charId), { text, updatedAt: Date.now() }),
    deleteSecret: (uid, charId) => deleteDoc(secretRef(uid, charId)),
  };
}
