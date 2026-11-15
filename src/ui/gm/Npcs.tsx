// The GM's NPC compendium: statblocks of people and mutants, read like the GM's document, edited in a dialog.
// Only the GM reaches it (route /gm/npc); players cannot read the compendium at all (firestore.rules).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { produce } from "immer";
import type { Catalog } from "../../rules/catalog";
import { ATTRS, MOD_CHOICES, MOD_INFO, SKILL_NAME } from "../../rules/data";
import { ACT_KINDS, CURRENCIES, NPC_SKILL_KEYS, PROT_KEYS, PROT_NAME, catGun, newNpc, npcHp, npcSkills, type ActKind, type NpcEntry, type NpcGun, type NpcKind, type NpcSkillKey } from "../../rules/npc";
import type { ModKind } from "../../rules/types";
import { useCampaign } from "../../state/context";
import { cx, uid } from "../../util";
import { Area, Box, Btn, Check, Confirm, Lab, NumIn, Text } from "../bits";
import { GroupField } from "../Gm";
import { GmFrame } from "./Frame";

export const skillName = (k: NpcSkillKey) => (k === "zone" ? "Знання Зони" : SKILL_NAME[k]);
const PROT_SHORT: Record<string, string> = { kin: "кін", acid: "кисл", fire: "вог", elec: "ел", rad: "рад" };
export const protText = (p: NpcEntry["prot"]) => PROT_KEYS.map(k => `${PROT_SHORT[k]} ${p[k]}`).join(" · ");
const gunLine = (r: NpcGun, cat: Catalog) => {
  const name = catGun(cat, r)?.n ?? r.n;
  return name + (r.mods.length ? ` (${r.mods.map(k => MOD_INFO[k].name.toLowerCase()).join(", ")})` : "");
};
const range = (r: NpcGun) => (r.lo === r.hi ? String(r.lo) : `${r.lo}–${r.hi}`);
/** Groups in the order they first appear. */
export const npcGroups = (list: NpcEntry[]) => { const out: string[] = []; for (const e of list) if (!out.includes(e.g)) out.push(e.g); return out; };

/** A statblock to read: everything the GM's document says about this NPC. */
export function StatBlock({ e, cat }: { e: NpcEntry; cat: Catalog }) {
  const sk = npcSkills(e);
  const skills = NPC_SKILL_KEYS.filter(k => sk[k]);
  const table = (name: string, rows: NpcGun[]) => rows.length > 0 && (
    <div><div className="lbl">{name}{rows.length > 1 ? ", к10" : ""}</div>
      {rows.map(r => <div key={r.id} className="sbline">{rows.length > 1 && <span className="num sbk">{range(r)}</span>}{gunLine(r, cat)}</div>)}
    </div>
  );
  const ammo = e.ammo.filter(a => a.cal || a.f), items = e.items.filter(i => i.n.trim());
  return (
    <div className="sb">
      <div className="sbattrs">{ATTRS.map(a => <div key={a.key}><b>{e.attrs[a.key]}</b><span>{a.name}</span></div>)}</div>
      <div className="sbline"><span className="lbl">Здоров'я</span> <b className="num">{e.hp}</b></div>
      <div className="sbline"><span className="lbl">Броня</span> {e.armor ? e.armor + ": " : ""}<span className="num">{protText(e.prot)}</span></div>
      {skills.length > 0 && <div className="chips">{skills.map(k => <span key={k} className="chip">{skillName(k)} {sk[k]}</span>)}</div>}
      {e.kind === "mutant" && <div className="hint">Без зброї дорівнює Тілобудові, Атлетика дорівнює Реакції.</div>}
      {table("Додаткова зброя", e.side)}
      {table("Основна зброя", e.main)}
      {e.gear.trim() && <div><div className="lbl">Завжди має</div><div className="pre">{e.gear}</div></div>}
      {ACT_KINDS.map(([kind, name]) => {
        const acts = e.acts.filter(a => a.kind === kind);
        if (!acts.length) return null;
        return (
          <div key={kind}><div className="lbl">{name}</div>
            {acts.map(a => (
              <div key={a.id} className="sbact">
                {a.name && <b>{a.name}. </b>}
                {a.atk != null && <span className="num sbroll">к10+{a.atk}{a.dmg ? `, шкода ${a.dmg}` : ""}. </span>}
                {a.atk == null && a.dmg && <span className="num sbroll">Шкода {a.dmg}. </span>}
                {a.text}
              </div>
            ))}
          </div>
        );
      })}
      {e.special.trim() && <div><div className="lbl">Особливості</div><div className="pre">{e.special}</div></div>}
      {(ammo.length > 0 || e.money || items.length > 0 || e.lootNote.trim()) && (
        <div><div className="lbl">Лут</div>
          {ammo.length > 0 && <div className="sbline">Набої: <span className="num">{ammo.map(a => `${a.cal} (${a.f})`).join(", ")}</span></div>}
          {e.money && <div className="sbline">Гроші: <span className="num">{e.money} {e.cur}</span></div>}
          {items.length > 0 && <div className="sbline">Речі: {items.map(i => i.n + (i.q !== 1 ? ` ×${i.q}` : "")).join(", ")}</div>}
          {e.lootNote.trim() && <div className="pre hint">{e.lootNote}</div>}
        </div>
      )}
      {e.d.trim() && <details className="sbdesc"><summary className="lbl">Опис</summary><div className="pre">{e.d}</div></details>}
    </div>
  );
}

export function NpcCompendium() {
  const [st, camp] = useCampaign();
  const [q, setQ] = useState("");
  const [view, setView] = useState<string | null>(null);
  const [dlg, setDlg] = useState<{ e: NpcEntry; isNew: boolean } | null>(null);
  const list = st.npcs, cat = st.catalog;
  const shown = list.filter(e => !q.trim() || e.n.toLowerCase().includes(q.trim().toLowerCase()));
  const viewed = view ? list.find(e => e.id === view) : undefined;

  const save = (e: NpcEntry, isNew: boolean) => {
    camp.updateNpcs(l => { const i = l.findIndex(x => x.id === e.id); if (i >= 0) l[i] = e; else l.push(e); });
    setDlg(null);
    if (isNew) { setQ(""); window.setTimeout(() => document.getElementById("npc-" + e.id)?.scrollIntoView({ block: "center" }), 60); }
  };

  return (
    <GmFrame sec="npcs" sub="Статблоки людей і мутантів" sync={st.npcSync}>
      <div className="row wrapg gmbar">
        <input className="in" style={{ flex: "1 1 12em" }} placeholder="Пошук за назвою" aria-label="Пошук за назвою" value={q} onChange={ev => setQ(ev.target.value)} />
        <Btn pri onClick={() => setDlg({ e: newNpc("human"), isNew: true })}>+ Людина</Btn>
        <Btn pri onClick={() => setDlg({ e: newNpc("mutant"), isNew: true })}>+ Мутант</Btn>
      </div>
      <Box title={`NPC · ${list.length}`}>
        <div>
          {!list.length && <p className="empty">Компендіум порожній.</p>}
          {list.length > 0 && !shown.length && <p className="empty">Нічого не знайдено.</p>}
          {npcGroups(shown).map(g => (
            <div key={g}>
              <div className="wgh lbl">{g || "Без групи"}</div>
              {shown.filter(e => e.g === g).map(e => {
                const guns = [...e.side, ...e.main].map(r => catGun(cat, r)?.n ?? r.n);
                const meta = [`ОЗ ${e.hp}`, e.armor || (e.prot.kin ? `кін ${e.prot.kin}` : ""), [...new Set(guns)].join(", ")].filter(Boolean).join(" · ");
                return (
                  <div className="card" key={e.id} id={"npc-" + e.id}>
                    <div className="row between" style={{ alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <b style={{ overflowWrap: "anywhere" }}>{e.n}</b>
                        <span className="hint num">{meta}</span>
                      </div>
                      <div className="row" style={{ flex: "none" }}>
                        <Btn sm onClick={() => setView(e.id)}>Статблок</Btn>
                        <Btn sm onClick={() => setDlg({ e, isNew: false })}>Змінити</Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Box>
      {viewed && (
        <Dialog title={viewed.n} close={() => setView(null)}>
          <StatBlock e={viewed} cat={cat} />
          <div className="row wrapg">
            <Btn pri onClick={() => { setView(null); setDlg({ e: viewed, isNew: false }); }}>Змінити</Btn>
            <Btn onClick={() => { setView(null); setDlg({ e: { ...structuredClone(viewed), id: uid(), n: viewed.n + " (копія)" }, isNew: true }); }}>Копія</Btn>
          </div>
        </Dialog>
      )}
      {dlg && <NpcDialog key={dlg.e.id} start={dlg.e} isNew={dlg.isNew} groups={npcGroups(list).filter(Boolean)} cat={cat}
        close={() => setDlg(null)} save={e => save(e, dlg.isNew)}
        remove={() => { camp.updateNpcs(l => l.filter(x => x.id !== dlg.e.id)); setDlg(null); }} />}
    </GmFrame>
  );
}

/** A dialog over the page: Escape and × close it. */
export function Dialog({ title, close, wide = true, children }: { title: string; close: () => void; wide?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    box.current?.focus();
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="overlay" role="presentation">
      <div className={cx("dialog box", wide && "wide")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}>
        <h2><span>{title}</span><Btn sm aria-label="Закрити" onClick={close}>×</Btn></h2>
        <div className="pad">{children}</div>
      </div>
    </div>
  );
}

function problem(e: NpcEntry): string {
  if (!e.n.trim()) return "Немає назви.";
  if (!e.g.trim()) return "Обери групу.";
  return "";
}

/** The statblock form, on a draft: «Додати»/«Зберегти» writes it, «Скасувати», × and Escape drop it. */
function NpcDialog({ start, isNew, groups, cat, save, remove, close }: {
  start: NpcEntry; isNew: boolean; groups: string[]; cat: Catalog; save: (e: NpcEntry) => void; remove: () => void; close: () => void;
}) {
  const [e, setE] = useState<NpcEntry>(() => structuredClone(start));
  const [err, setErr] = useState("");
  const set = (fn: (x: NpcEntry) => void) => { setErr(""); setE(prev => produce(prev, fn)); };
  const submit = () => { const why = problem(e); if (why) { setErr(why); return; } save(e); };
  const sk = npcSkills(e);
  const derived: NpcSkillKey[] = e.kind === "mutant" ? ["unarmed", "athletics"] : [];
  const own = NPC_SKILL_KEYS.filter(k => e.skills[k] !== undefined && !derived.includes(k));
  const free = NPC_SKILL_KEYS.filter(k => e.skills[k] === undefined && !derived.includes(k));
  const [pickSkill, setPickSkill] = useState<NpcSkillKey | "">("");
  const nextSkill = free.find(k => k === pickSkill) ?? free[0];
  const formula = npcHp(e.attrs);

  return (
    <Dialog title={isNew ? (e.kind === "mutant" ? "Новий мутант" : "Нова людина") : e.n || "NPC"} close={close}>
      <div className="fgrid">
        <Lab name="Назва" wide><Text value={e.n} set={v => set(x => { x.n = v; })} /></Lab>
        <GroupField value={e.g} groups={groups} set={v => set(x => { x.g = v; })} />
        <Lab name="Тип" className="wsm">
          <select className="in" value={e.kind} onChange={ev => set(x => { x.kind = ev.target.value as NpcKind; })}>
            <option value="human">Людина</option><option value="mutant">Мутант</option>
          </select>
        </Lab>
        {ATTRS.map(a => <Lab key={a.key} name={a.name}><NumIn value={e.attrs[a.key]} set={v => set(x => { x.attrs[a.key] = Math.round(v); })} /></Lab>)}
        <Lab name="Здоров'я">
          <div className="row"><NumIn value={e.hp} set={v => set(x => { x.hp = Math.round(v); })} />
            <Btn sm title="Тілобудова × 5 + 10" disabled={e.hp === formula} onClick={() => set(x => { x.hp = formula; })}>{formula}</Btn></div>
        </Lab>
        <Lab name="Опис" wide><Area value={e.d} rows={2} set={v => set(x => { x.d = v; })} /></Lab>
      </div>

      <Section name="Навички">
        {derived.length > 0 && <div className="hint">Без зброї {sk.unarmed}, Атлетика {sk.athletics}: рахуються з Тілобудови й Реакції.</div>}
        {own.map(k => (
          <div className="row fxrow" key={k}>
            <span className="fxn">{skillName(k)}</span>
            <NumIn className="w4 num" label={skillName(k)} value={e.skills[k] ?? 0} set={v => set(x => { x.skills[k] = Math.round(v); })} />
            <Btn sm aria-label={`Прибрати: ${skillName(k)}`} onClick={() => set(x => { delete x.skills[k]; })}>×</Btn>
          </div>
        ))}
        {nextSkill && (
          <div className="row wrapg">
            <select className="in" aria-label="Яку навичку додати" value={nextSkill} onChange={ev => setPickSkill(ev.target.value as NpcSkillKey)}>
              {free.map(k => <option key={k} value={k}>{skillName(k)}</option>)}
            </select>
            <Btn onClick={() => { set(x => { x.skills[nextSkill] = 1; }); setPickSkill(""); }}>Додати</Btn>
          </div>
        )}
      </Section>

      <Section name="Броня">
        <div className="fgrid">
          <Lab name="З каталогу" wide>
            <select className="in" value="" onChange={ev => { const a = cat.armors.find(x => x.id === ev.target.value); if (a) set(x => { x.armor = a.n; x.prot = { kin: a.kin, acid: a.acid, fire: a.fire, elec: a.elec, rad: a.rad }; }); }}>
              <option value="">— підставити броню —</option>
              {cat.armors.map(a => <option key={a.id} value={a.id}>{a.n}</option>)}
            </select>
          </Lab>
          <Lab name="Назва" wide><Text value={e.armor} placeholder={e.kind === "mutant" ? "шкура, панцир" : ""} set={v => set(x => { x.armor = v; })} /></Lab>
          {PROT_KEYS.map(k => <Lab key={k} name={PROT_NAME[k]}><NumIn value={e.prot[k]} set={v => set(x => { x.prot[k] = Math.round(v); })} /></Lab>)}
        </div>
      </Section>

      <GunTable name="Додаткова зброя" rows={e.side} cat={cat} set={fn => set(x => { fn(x.side); })} />
      <GunTable name="Основна зброя" rows={e.main} cat={cat} set={fn => set(x => { fn(x.main); })} />
      <Lab name="Завжди має"><Area value={e.gear} rows={2} placeholder="ніж, РГД-5" set={v => set(x => { x.gear = v; })} /></Lab>

      <Section name="Дії">
        {e.acts.map((a, i) => (
          <div className="npcact" key={a.id}>
            <div className="row wrapg">
              <select className="in" aria-label="Яка дія" value={a.kind} style={{ flex: "0 1 12em" }} onChange={ev => set(x => { x.acts[i].kind = ev.target.value as ActKind; })}>
                {ACT_KINDS.map(([k, n]) => <option key={k} value={k}>{n.replace(" дії", "")}</option>)}
              </select>
              <input className="in" style={{ flex: "1 1 8em" }} aria-label="Назва дії" placeholder="Назва" value={a.name} onChange={ev => set(x => { x.acts[i].name = ev.target.value; })} />
              <Btn sm aria-label="Прибрати дію" onClick={() => set(x => { x.acts.splice(i, 1); })}>×</Btn>
            </div>
            <div className="row wrapg">
              <Check checked={a.atk != null} set={v => set(x => { x.acts[i].atk = v ? x.attrs.til : null; })}>Атака к10 +</Check>
              <NumIn className="w4 num" label="Що додається до к10" value={a.atk ?? 0} set={v => set(x => { x.acts[i].atk = Math.round(v); })} />
              <input className="in w6" aria-label="Шкода" placeholder="шкода к5+2" value={a.dmg} onChange={ev => set(x => { x.acts[i].dmg = ev.target.value; })} />
            </div>
            <Area value={a.text} rows={2} label="Що робить" placeholder="Що робить" set={v => set(x => { x.acts[i].text = v; })} />
          </div>
        ))}
        <div><Btn onClick={() => set(x => { x.acts.push({ id: uid(), kind: "main", name: "", atk: x.kind === "mutant" ? x.attrs.til : null, dmg: "", text: "" }); })}>+ Дія</Btn></div>
      </Section>
      <Lab name="Особливості"><Area value={e.special} rows={3} set={v => set(x => { x.special = v; })} /></Lab>

      <Section name="Лут">
        <div className="hint">Формули: 20+к10, 2к10, к10*100. У бою чарнік кидає їх сам.</div>
        {e.ammo.map((a, i) => (
          <div className="row" key={a.id}>
            <input className="in" aria-label="Калібр" placeholder="калібр 9×18" value={a.cal} onChange={ev => set(x => { x.ammo[i].cal = ev.target.value; })} />
            <input className="in w6" aria-label="Скільки набоїв" placeholder="20+к10" value={a.f} onChange={ev => set(x => { x.ammo[i].f = ev.target.value; })} />
            <Btn sm aria-label="Прибрати набої" onClick={() => set(x => { x.ammo.splice(i, 1); })}>×</Btn>
          </div>
        ))}
        <div><Btn onClick={() => set(x => { x.ammo.push({ id: uid(), cal: "", f: "20+к10" }); })}>+ Набої</Btn></div>
        <div className="row">
          <input className="in" aria-label="Скільки грошей" placeholder="гроші: 2к10" value={e.money} onChange={ev => set(x => { x.money = ev.target.value; })} />
          <select className="in" aria-label="Валюта" value={e.cur} style={{ flex: "0 1 8em" }} onChange={ev => set(x => { x.cur = ev.target.value; })}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {e.items.map((it, i) => (
          <div className="row" key={it.id}>
            <input className="in" aria-label="Річ" placeholder="річ" value={it.n} onChange={ev => set(x => { x.items[i].n = ev.target.value; })} />
            <NumIn className="w4 num" label="Скільки" value={it.q} set={v => set(x => { x.items[i].q = Math.round(v); })} />
            <Btn sm aria-label="Прибрати річ" onClick={() => set(x => { x.items.splice(i, 1); })}>×</Btn>
          </div>
        ))}
        <div><Btn onClick={() => set(x => { x.items.push({ id: uid(), n: "", q: 1 }); })}>+ Річ</Btn></div>
        <Lab name="Шанси й інше"><Area value={e.lootNote} rows={2} placeholder="10%: артефакт" set={v => set(x => { x.lootNote = v; })} /></Lab>
      </Section>

      {err && <div className="neg">{err}</div>}
      <div className="row between wrapg">
        <div className="row">
          <Btn pri onClick={submit}>{isNew ? "Додати" : "Зберегти"}</Btn>
          <Btn onClick={close}>Скасувати</Btn>
        </div>
        {!isNew && <Confirm sm={false} label="Видалити" ask="Точно видалити?" title="Видалити з компендіуму" onConfirm={remove} />}
      </div>
    </Dialog>
  );
}

function Section({ name, children }: { name: string; children: ReactNode }) {
  return <div className="npcsec"><div className="lbl">{name}</div>{children}</div>;
}

/** A weapon table: на к10 from–to, a weapon from the catalogue, its attachments. One line means it always carries that. */
function GunTable({ name, rows, cat, set }: { name: string; rows: NpcGun[]; cat: Catalog; set: (fn: (rows: NpcGun[]) => void) => void }) {
  const [mod, setMod] = useState<ModKind>("silencer");
  const groups = [...new Set(cat.guns.map(g => g.g))];
  return (
    <Section name={name + (rows.length > 1 ? ", к10" : "")}>
      {rows.map((r, i) => (
        <div className="npcgun" key={r.id}>
          <div className="row">
            {rows.length > 1 && <>
              <NumIn className="w3 num" label="Від" value={r.lo} set={v => set(x => { x[i].lo = Math.max(1, Math.min(10, Math.round(v))); })} />
              <span className="hint">–</span>
              <NumIn className="w3 num" label="До" value={r.hi} set={v => set(x => { x[i].hi = Math.max(1, Math.min(10, Math.round(v))); })} />
            </>}
            <select className="in" aria-label="Зброя" value={catGun(cat, r)?.id ?? ""} onChange={ev => { const g = cat.guns.find(x => x.id === ev.target.value); if (g) set(x => { x[i].gun = g.id; x[i].n = g.n; }); }}>
              {!catGun(cat, r) && <option value="">{r.n || "— обери —"}</option>}
              {groups.map(gr => <optgroup key={gr} label={gr}>{cat.guns.filter(g => g.g === gr).map(g => <option key={g.id} value={g.id}>{g.n}</option>)}</optgroup>)}
            </select>
            <Btn sm aria-label="Прибрати рядок" onClick={() => set(x => { x.splice(i, 1); })}>×</Btn>
          </div>
          <div className="row wrapg">
            {r.mods.map(k => <span key={k} className="chip">{MOD_INFO[k].name}<button type="button" aria-label={`Прибрати: ${MOD_INFO[k].name}`} onClick={() => set(x => { x[i].mods = x[i].mods.filter(m => m !== k); })}>×</button></span>)}
            <select className="in" aria-label="Модифікація" value={mod} style={{ flex: "0 1 11em" }} onChange={ev => setMod(ev.target.value as ModKind)}>
              {MOD_CHOICES.filter(k => k !== "other").map(k => <option key={k} value={k}>{MOD_INFO[k].name}</option>)}
            </select>
            <Btn sm disabled={r.mods.includes(mod)} onClick={() => set(x => { x[i].mods.push(mod); })}>+ модифікація</Btn>
          </div>
        </div>
      ))}
      <div><Btn onClick={() => set(x => {
        const last = x[x.length - 1];
        const lo = last ? Math.min(10, last.hi + 1) : 1;
        const g = cat.guns[0];
        x.push({ id: uid(), lo, hi: 10, gun: g?.id ?? "", n: g?.n ?? "", mods: [] });
      })}>+ Рядок</Btn></div>
    </Section>
  );
}
