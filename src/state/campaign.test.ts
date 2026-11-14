import { describe, expect, it, vi } from "vitest";
import { memoryBackend } from "../backend/memory";
import { blankCharacter, maxHp } from "../rules/character";
import { Campaign } from "./campaign";

const tick = () => new Promise<void>(r => setTimeout(r, 0));
const me = { uid: "u1", name: "Я" };

async function signedIn() {
  const be = memoryBackend({ user: me, seed: true });
  const notes: string[] = [];
  const camp = new Campaign(be, m => notes.push(m));
  camp.start();
  await be.signIn();
  await tick();
  return { be, camp, notes };
}
function sheet(callsign: string) {
  const c = blankCharacter();
  c.id.callsign = callsign; c.attrs.til = 3; c.hp = maxHp(c);
  return c;
}

describe("campaign store", () => {
  it("starts signed out and lists other players' sheets after sign-in", async () => {
    const be = memoryBackend({ user: me, seed: true });
    const camp = new Campaign(be);
    camp.start(); await tick();
    expect(camp.get().authReady).toBe(true);
    expect(camp.get().user).toBeNull();
    await be.signIn(); await tick();
    expect(camp.get().loaded).toBe(true);
    expect(Object.keys(camp.get().entries)).toEqual(["demo-other"]);
    expect(camp.isMine("demo-other")).toBe(false);
  });

  it("creates a sheet as mine and saves edits after a pause", async () => {
    vi.useFakeTimers();
    const { be, camp } = await (async () => { vi.useRealTimers(); const x = await signedIn(); vi.useFakeTimers(); return x; })();
    const id = camp.create(sheet("Мій"), "таємниця");
    expect(camp.isMine(id)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(be.docs.get(id)?.owner).toBe("u1");
    expect(be.secrets.get("u1/" + id)).toBe("таємниця");

    camp.update(id, c => { c.hp -= 4; });
    expect(camp.charOf(id)?.hp).toBe(21);
    expect(camp.get().sync).toBe("saving");
    expect(be.docs.get(id)?.char.hp).toBe(25); // not sent yet
    await vi.advanceTimersByTimeAsync(1000);
    expect(be.docs.get(id)?.char.hp).toBe(21);
    expect(camp.get().sync).toBe("ok");
    vi.useRealTimers();
  });

  it("never writes to someone else's sheet", async () => {
    const { be, camp } = await signedIn();
    const before = JSON.stringify(be.docs.get("demo-other"));
    camp.update("demo-other", c => { c.hp = 1; });
    camp.remove("demo-other");
    await tick();
    expect(JSON.stringify(be.docs.get("demo-other"))).toBe(before);
    expect(camp.charOf("demo-other")?.hp).not.toBe(1);
  });

  it("takes a newer copy from another device but keeps its own unsaved edit over an older one", async () => {
    const { be, camp } = await signedIn();
    const id = camp.create(sheet("Мій")); await tick();
    const doc = structuredClone(be.docs.get(id)!);
    be.writeAs(id, { ...doc, by: "phone", updatedAt: Date.now() + 5000, char: { ...doc.char, hp: 7 } });
    expect(camp.charOf(id)?.hp).toBe(7);
    be.writeAs(id, { ...doc, by: "phone", updatedAt: 1, char: { ...doc.char, hp: 3 } });
    expect(camp.charOf(id)?.hp).toBe(7);
  });

  it("removes my sheet and clears everything on sign-out", async () => {
    const { be, camp } = await signedIn();
    const id = camp.create(sheet("Мій")); await tick();
    camp.remove(id); await tick();
    expect(be.docs.has(id)).toBe(false);
    expect(camp.charOf(id)).toBeNull();
    await be.signOut();
    expect(camp.get().user).toBeNull();
    expect(camp.get().entries).toEqual({});
  });

  it("exports a sheet with or without private notes", async () => {
    const { camp } = await signedIn();
    const id = camp.create(sheet("Мій"), "таємниця"); await tick();
    expect((await camp.exportChar(id, true))?.secret).toBe("таємниця");
    expect((await camp.exportChar(id, false))?.secret).toBeUndefined();
  });
});
