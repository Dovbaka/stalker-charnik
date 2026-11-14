import { describe, expect, it, vi } from "vitest";
import { memoryBackend } from "../backend/memory";
import { blankCharacter, maxHp } from "../rules/character";
import { Campaign } from "./campaign";

const tick = () => new Promise<void>(r => setTimeout(r, 0));
const me = { uid: "u1", name: "Я" };

async function signedIn(user = me, gms: string[] = []) {
  const be = memoryBackend({ user, seed: true, gms });
  const notes: string[] = [];
  const camp = new Campaign(be, m => notes.push(m), gms);
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

  it("takes a change from another device and keeps its own fields that are not saved yet", async () => {
    const { be, camp } = await signedIn();
    const id = camp.create(sheet("Мій")); await tick();
    const doc = structuredClone(be.docs.get(id)!);
    be.writeAs(id, { ...doc, by: "phone", char: { ...doc.char, hp: 7 } });
    expect(camp.charOf(id)?.hp).toBe(7);
    camp.update(id, c => { c.rad = 50; }); // typed here, still waiting for the pause
    be.writeAs(id, { ...doc, by: "phone", char: { ...doc.char, hp: 3, money: 10 } });
    expect(camp.charOf(id)).toMatchObject({ hp: 3, money: 10, rad: 50 });
  });

  it("sends only the changed fields, so another writer's field survives", async () => {
    vi.useFakeTimers();
    const { be, camp } = await (async () => { vi.useRealTimers(); const x = await signedIn(); vi.useFakeTimers(); return x; })();
    const id = camp.create(sheet("Мій")); await vi.advanceTimersByTimeAsync(0);
    camp.update(id, c => { c.rad = 40; });
    // meanwhile the GM's write reaches the server, after this tab last heard from it
    const doc = be.docs.get(id)!;
    be.docs.set(id, { ...doc, by: "gm", char: { ...doc.char, money: 999 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(be.docs.get(id)?.char).toMatchObject({ rad: 40, money: 999 });
    vi.useRealTimers();
  });

  it("lets the GM change health and gear on another player's sheet, and nothing else", async () => {
    vi.useFakeTimers();
    const gm = { uid: "gm1", name: "Майстер" };
    const { be, camp, notes } = await (async () => { vi.useRealTimers(); const x = await signedIn(gm, ["gm1"]); vi.useFakeTimers(); return x; })();
    expect(camp.get().gm).toBe(true);
    expect(camp.canEdit("demo-other")).toBe(true);
    camp.update("demo-other", c => { c.hp = 5; c.items.push({ id: "x", name: "Бинт", qty: 1, w: 0.1, note: "" }); });
    await vi.advanceTimersByTimeAsync(1000);
    expect(be.docs.get("demo-other")?.char.hp).toBe(5);
    expect(be.docs.get("demo-other")?.char.items.map(i => i.name)).toContain("Бинт");
    camp.update("demo-other", c => { c.skills.rifles = 9; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(be.docs.get("demo-other")?.char.skills.rifles).not.toBe(9);
    expect(notes.some(n => n.includes("на цю картку немає прав"))).toBe(true);
    camp.remove("demo-other"); // deleting stays the owner's
    await vi.advanceTimersByTimeAsync(0);
    expect(be.docs.has("demo-other")).toBe(true);
    vi.useRealTimers();
  });

  it("puts back exactly what one change did", async () => {
    const { camp } = await signedIn();
    const id = camp.create(sheet("Мій")); await tick();
    const undo = camp.update(id, c => { c.hp -= 8; });
    camp.update(id, c => { c.rad = 30; });
    undo?.();
    expect(camp.charOf(id)).toMatchObject({ hp: 25, rad: 30 });
    expect(camp.update(id, () => {})).toBeNull(); // no change, nothing to undo
  });

  it("keeps the catalogue the GM's: the GM saves it, a player cannot", async () => {
    vi.useFakeTimers();
    const gm = { uid: "gm1", name: "Майстер" };
    const x = await (async () => { vi.useRealTimers(); const r = await signedIn(gm, ["gm1"]); vi.useFakeTimers(); return r; })();
    const before = x.camp.get().catalog.items.length;
    x.camp.updateCatalog(c => { c.items.push({ id: "new", g: "Різне", n: "Компас", w: 0.2, p: 150 }); });
    await vi.advanceTimersByTimeAsync(1000);
    expect(x.camp.get().catalog.items.length).toBe(before + 1);
    expect(x.camp.get().catalogSync).toBe("ok");
    vi.useRealTimers();

    const p = await signedIn();
    p.camp.updateCatalog(c => { c.items = []; });
    expect(p.camp.get().catalog.items.length).toBeGreaterThan(0);
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
