// The GM's encounters: prepared fights, kept until deleted (routes /gm/enc and /gm/enc/{id}).
// A foe is one copy of a statblock with its own health, weapons, rounds and loot. The initiative list holds foes and
// players' characters; «Далі» passes the turn. Attack rolls stay at the table: the calculator only says what the die
// must show. Gear, rounds and money are rolled here by the formulas of the statblock, and any of it can be typed over.
import { useEffect, useState } from "react";
import { derive, rangedWeapons, type DamageType } from "../../rules/character";
import { MOD_INFO } from "../../rules/data";
import { PROT_KEYS, foeReload, foeReserve, addFoes, addPcs, combatants, endFight, foeDamage, foeHeal, nextTurn, removeCombatant, rollGear, setFoeWeapon, sortInitiative, startFight, type Encounter, type Foe, type NpcEntry } from "../../rules/npc";
import { navigate } from "../../router";
import { useCampaign } from "../../state/context";
import { clamp, cx, dateStr, num } from "../../util";
import { Area, Box, Btn, Confirm, KV, Meter, NumIn, Stepper, Tg, toast } from "../bits";
import { ShotPanel } from "../ShotPanel";
import { GmFrame } from "./Frame";
import { StatBlock, npcGroups } from "./Npcs";

const enemies = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "ворог" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "вороги" : "ворогів");

export function EncounterList() {
  const [st, camp] = useCampaign();
  const list = Object.values(st.encounters).sort((a, b) => b.updatedAt - a.updatedAt);
  const create = () => { const id = camp.createEncounter(`Енкаунтер ${list.length + 1}`); if (id) navigate({ name: "enc", id }); };
  return (
    <GmFrame sec="encs" sub="Підготовлені бої" sync={st.encSync}>
      <div className="row wrapg gmbar"><Btn pri onClick={create}>+ Новий енкаунтер</Btn></div>
      <Box title={`Енкаунтери · ${list.length}`}>
        <div>
          {!st.encLoaded && <p className="empty">Завантажую…</p>}
          {st.encLoaded && !list.length && <p className="empty">Енкаунтерів ще немає.</p>}
          {list.map(e => (
            <div className="card" key={e.id}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <b style={{ overflowWrap: "anywhere" }}>{e.name}</b>
                  <span className="hint num">{[`${e.foes.length} ${enemies(e.foes.length)}`, `гравців ${e.pcs.length}`, e.round ? `раунд ${e.round}` : "", dateStr(e.updatedAt)].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="row" style={{ flex: "none" }}>
                  <Btn sm onClick={() => { const id = camp.createEncounter(e.name + " (копія)", e); if (id) toast("Копію створено."); }}>Копія</Btn>
                  <Btn sm pri onClick={() => navigate({ name: "enc", id: e.id })}>Відкрити</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Box>
    </GmFrame>
  );
}

export function EncounterView({ id }: { id: string }) {
  const [st, camp] = useCampaign();
  const enc = st.encounters[id];
  const [sel, setSel] = useState("");
  // a deleted or unknown encounter sends the GM back to the list
  const missing = st.encLoaded && !enc;
  useEffect(() => { if (missing) { toast("Такого енкаунтера немає."); navigate({ name: "encs" }, true); } }, [missing]);
  if (!enc) return <GmFrame sec="encs" sub="Енкаунтер" sync={st.encSync}><p className="empty">Завантажую…</p></GmFrame>;

  const up = (fn: (e: Encounter) => void) => camp.updateEncounter(id, fn);
  const chars = st.entries;
  const rea = (charId: string) => { const c = chars[charId]?.char; return c ? derive(c).eff.rea : 0; };
  const list = combatants(enc, rea);
  const foe = enc.foes.find(f => f.id === sel) ?? enc.foes.find(f => f.id === enc.turn) ?? enc.foes[0];
  const entry = foe ? st.npcs.find(e => e.id === foe.npc) : undefined;

  return (
    <GmFrame sec="encs" sub={enc.name} sync={st.encSync}>
      <div className="row wrapg gmbar">
        <Btn onClick={() => navigate({ name: "encs" })}>← Енкаунтери</Btn>
        <input className="in" style={{ flex: "1 1 12em" }} aria-label="Назва енкаунтера" value={enc.name} onChange={ev => up(e => { e.name = ev.target.value; })} />
        <Confirm sm={false} label="Видалити" ask="Точно видалити енкаунтер?" title="Видалити енкаунтер"
          onConfirm={() => { camp.removeEncounter(id); navigate({ name: "encs" }, true); }} />
      </div>
      <main className="cols encols">
        <div className="col">
          <InitiativeBox enc={enc} list={list} chars={chars} rea={rea} up={up} sel={foe?.id ?? ""} select={setSel} />
          <AddBox npcs={st.npcs} up={up} cat={st.catalog} chars={Object.keys(chars)} select={setSel} />
          <Box title="Нотатки"><div className="pad"><Area value={enc.note} rows={3} label="Нотатки до енкаунтера" set={v => up(e => { e.note = v; })} /></div></Box>
        </div>
        <div className="col" id="foe-card">
          {foe ? <FoeBox key={foe.id} foe={foe} entry={entry} up={up} rea={rea} />
            : <Box title="Ворог"><p className="empty">Додай ворогів з компендіуму.</p></Box>}
        </div>
        <div className="col">
          {foe && (foe.kind === "human" || rangedWeapons(foe).length > 0) && (
            <ShotPanel title={`Постріл: ${foe.name}`} storeKey="charnik.foeshot" checkPen={0} who={{ skills: foe.skills, weapons: foe.weapons, mask: false }} />
          )}
          {foe && <Box title="Статблок">{entry ? <div className="pad"><StatBlock e={entry} cat={st.catalog} /></div> : <p className="empty">Статблок видалено з компендіуму.</p>}</Box>}
        </div>
      </main>
    </GmFrame>
  );
}

type Up = (fn: (e: Encounter) => void) => (() => void) | null;

/** The initiative list: who acts now, numbers typed by the GM, «Почати бій» sorts and starts, «Далі» passes the turn. */
function InitiativeBox({ enc, list, chars, rea, up, sel, select }: {
  enc: Encounter; list: ReturnType<typeof combatants>; chars: ReturnType<typeof useCampaign>[0]["entries"];
  rea: (id: string) => number; up: Up; sel: string; select: (id: string) => void;
}) {
  const started = enc.round > 0;
  const next = () => { let to = ""; up(e => { nextTurn(e, rea); to = e.turn; }); if (enc.foes.some(f => f.id === to)) select(to); };
  const start = () => { let to = ""; up(e => { startFight(e, rea); to = e.turn; }); if (enc.foes.some(f => f.id === to)) select(to); };
  return (
    <Box title={started ? `Ініціатива · раунд ${enc.round}` : "Ініціатива"} right={<Btn sm disabled={list.length < 2} onClick={() => up(e => { sortInitiative(e, rea); })}>Сортувати</Btn>}>
      <div>
        {!list.length && <p className="empty">Тут поки нікого.</p>}
        {list.map(c => {
          const f = c.kind === "foe" ? enc.foes.find(x => x.id === c.id)! : null;
          const p = c.kind === "pc" ? enc.pcs.find(x => x.id === c.id)! : null;
          const ch = p ? chars[p.char]?.char : null;
          const name = f ? f.name : ch ? ch.id.callsign || ch.id.name || "Без імені" : "Персонажа видалено";
          const hp = f ? `${f.hp}/${f.max}` : ch ? `${ch.hp}/${derive(ch).max}` : "";
          const setInit = (v: number | null) => up(e => {
            const x = f ? e.foes.find(y => y.id === c.id) : e.pcs.find(y => y.id === c.id);
            if (x) x.init = v;
          });
          return (
            <div key={c.id} className={cx("irow2", enc.turn === c.id && "turn", c.out && "out", f && sel === c.id && "sel")}>
              <span className="imark" aria-label={enc.turn === c.id ? "Ходить зараз" : undefined}>{enc.turn === c.id ? "▶" : ""}</span>
              {f ? <button type="button" className="iname" onClick={() => {
                select(c.id);
                // on a phone the columns stack: bring the foe's card up
                if (window.innerWidth < 760) window.setTimeout(() => document.getElementById("foe-card")?.scrollIntoView({ block: "start" }), 30);
              }}>{name}</button> : <span className="iname pc">{name}</span>}
              <span className="hint num ihp">{f?.out === "dead" ? "мертвий" : f?.out === "fled" ? "утік" : hp}</span>
              <InitIn value={c.init} rea={c.rea} set={setInit} />
              {p ? <Btn sm aria-label={`Прибрати ${name}`} onClick={() => up(e => { removeCombatant(e, c.id, rea); })}>×</Btn> : <span className="ixsp" />}
            </div>
          );
        })}
        <div className="pad">
          <div className="row wrapg">
            {!started ? <Btn pri disabled={!list.length} onClick={start}>Почати бій</Btn> : <>
              <Btn pri onClick={next}>Далі</Btn>
              <Btn onClick={() => up(e => { endFight(e); })}>Завершити бій</Btn>
            </>}
          </div>
        </div>
      </div>
    </Box>
  );
}

/** An initiative number typed in; empty means not rolled yet. The placeholder says what is added to к10. */
function InitIn({ value, rea, set }: { value: number | null; rea: number; set: (v: number | null) => void }) {
  const [raw, setRaw] = useState(value == null ? "" : String(value));
  useEffect(() => { const n = raw.trim() === "" ? null : num(raw, NaN); if (n !== value) setRaw(value == null ? "" : String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="in w4 num iinit" inputMode="numeric" aria-label="Ініціатива" placeholder={`к10+${rea}`} value={raw}
    onChange={ev => { setRaw(ev.target.value); const t = ev.target.value.trim(); set(t === "" ? null : Math.round(num(t, 0))); }} />;
}

/** Foes from the compendium, several at once, and every player's character with one button. */
function AddBox({ npcs, cat, chars, up, select }: { npcs: NpcEntry[]; cat: ReturnType<typeof useCampaign>[0]["catalog"]; chars: string[]; up: Up; select: (id: string) => void }) {
  const [pick, setPick] = useState("");
  const [count, setCount] = useState(1);
  const e = npcs.find(x => x.id === pick) ?? npcs[0];
  return (
    <Box title="Додати">
      <div className="pad">
        {npcs.length ? <>
          <select className="in" aria-label="Кого додати" value={e?.id ?? ""} onChange={ev => setPick(ev.target.value)}>
            {npcGroups(npcs).map(g => <optgroup key={g} label={g || "Без групи"}>{npcs.filter(x => x.g === g).map(x => <option key={x.id} value={x.id}>{x.n}</option>)}</optgroup>)}
          </select>
          <div className="row between">
            <Stepper value={count} min={1} max={12} set={setCount} />
            <Btn pri onClick={() => { if (!e) return; let ids: string[] = []; up(x => { ids = addFoes(x, e, cat, count); }); if (ids[0]) select(ids[0]); }}>Додати ворогів</Btn>
          </div>
        </> : <span className="hint">Компендіум NPC порожній.</span>}
        <Btn onClick={() => { let n = 0; up(x => { n = addPcs(x, chars); }); toast(n ? `Додано гравців: ${n}.` : "Усі гравці вже тут."); }}>+ Гравці</Btn>
      </div>
    </Box>
  );
}

const DMG_TYPES: [DamageType, string, (typeof PROT_KEYS)[number] | null][] = [["kin", "Кінетика", "kin"], ["none", "Повз броню", null], ["acid", "Кислота", "acid"], ["fire", "Вогонь", "fire"], ["elec", "Електрика", "elec"]];
const PROT_TILE: Record<string, string> = { kin: "Кінет", acid: "Кисл", fire: "Вогонь", elec: "Елект", rad: "Рад" };

/** One foe: health with damage through its protection, weapons with their rounds, the rest of the loot. */
function FoeBox({ foe, entry, up, rea }: { foe: Foe; entry: NpcEntry | undefined; up: Up; rea: (id: string) => number }) {
  const [st] = useCampaign();
  const [amt, setAmt] = useState("");
  const [type, setType] = useState<DamageType>("kin");
  const upF = (fn: (f: Foe) => void) => up(e => { const f = e.foes.find(x => x.id === foe.id); if (f) fn(f); });
  const amount = () => { const n = Math.round(num(amt, 1)); return n > 0 ? n : 0; };
  const hurt = () => {
    const n = amount(); setAmt(""); if (!n) return;
    let res = { real: 0, absorbed: 0 };
    const undo = upF(f => { res = foeDamage(f, n, type); });
    toast(!res.absorbed ? `${foe.name}: −${res.real} ОЗ.` : res.real ? `${foe.name}: −${res.real} ОЗ, броня зняла ${res.absorbed}.` : "Броня втримала всю шкоду.", undo);
  };
  const heal = () => { const n = amount(); setAmt(""); if (!n) return; const undo = upF(f => { foeHeal(f, n); }); toast(`${foe.name}: +${n} ОЗ.`, undo); };
  const level = foe.hp <= 0 ? 4 : foe.hp <= foe.max * 0.25 ? 3 : foe.hp <= foe.max * 0.5 ? 2 : foe.hp <= foe.max * 0.75 ? 1 : 0;
  const ammo = foe.items.filter(i => i.ammo), loot = foe.items.filter(i => !i.ammo);
  // a mutant with nothing to roll or carry shows no loot lines
  const rollable = !!entry && (entry.side.length > 0 || entry.main.length > 0 || entry.ammo.length > 0 || !!entry.money);
  const showMoney = !!entry?.money || foe.money > 0;
  const reroll = () => {
    if (!entry) return;
    const undo = upF(f => { rollGear(f, entry, st.catalog); });
    toast("Спорядження кинуто заново.", undo);
  };

  return (
    <Box title={foe.name} right={<span className="hint num">{foe.kind === "mutant" ? "мутант" : "людина"}</span>}>
      <div className="pad">
        <div className="seg">
          <Tg on={!foe.out} onClick={() => upF(f => { f.out = ""; })}>У бою</Tg>
          <Tg on={foe.out === "dead"} onClick={() => upF(f => { f.out = "dead"; })}>Мертвий</Tg>
          <Tg on={foe.out === "fled"} onClick={() => upF(f => { f.out = "fled"; })}>Утік</Tg>
        </div>
        <div className="hprow"><span className={`hpnum l${level}`}>{foe.hp}<small>/{foe.max}</small></span></div>
        <Meter value={foe.hp} max={foe.max} cls={`l${level}`} label={`Здоров'я ${foe.hp} з ${foe.max}`} />
        <div className="hpctl">
          <select className="in" aria-label="Чим поранено" value={type} onChange={ev => setType(ev.target.value as DamageType)}>
            {DMG_TYPES.map(([k, n, p]) => <option key={k} value={k}>{n}{p ? `, броня ${foe.prot[p]}` : ""}</option>)}
          </select>
          <input className="in hpamt num" inputMode="numeric" placeholder="0" aria-label="Скільки" value={amt} onChange={ev => setAmt(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") hurt(); }} />
          <Btn className="hurt" onClick={hurt}>Шкода</Btn>
          <Btn className="heal" onClick={heal}>Лікувати</Btn>
        </div>
        <div className="prot">{PROT_KEYS.map(k => <div key={k}><b>{foe.prot[k]}</b><span>{PROT_TILE[k]}</span></div>)}</div>
      </div>

      {foe.weapons.map((g, i) => {
        const mag = num(g.mag), cur = clamp(num(g.cur), 0, mag), jams = num(g.jams);
        const rows = g.slot && entry ? entry[g.slot] : [];
        const reserve = foeReserve(foe, g);
        const meta = [g.range, g.dmg, g.cal].filter(Boolean).join(" · ");
        return (
          <div className="card" key={g.id}>
            {rows.length > 1 ? (
              <select className="in" aria-label="Яка зброя" value={g.row} onChange={ev => upF(f => { if (entry && g.slot) setFoeWeapon(f, entry, st.catalog, g.slot, ev.target.value); })}>
                {rows.map(r => <option key={r.id} value={r.id}>{r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`}: {r.n}</option>)}
              </select>
            ) : <h3>{g.name}</h3>}
            {meta && <span className="hint num">{meta}</span>}
            {g.mods.length > 0 && <div className="chips">{g.mods.map(md => <span key={md.id} className="chip" title={MOD_INFO[md.kind]?.info || undefined}>{md.name}</span>)}</div>}
            {mag > 0 && <>
              <div className="row wrapg">
                <span className="ammo">{cur}/{mag}</span>
                <Btn onClick={() => { if (cur <= 0) { toast("Магазин порожній."); return; } upF(f => { f.weapons[i].cur = cur - 1; }); }}>Постріл</Btn>
                <Btn pri onClick={() => { let msg = ""; upF(f => { msg = foeReload(f, g.id); }); if (msg) toast(msg); }}>Перезарядити</Btn>
                <span className="hint num">запас {reserve ? num(reserve.qty) : 0}</span>
              </div>
              {mag <= 40 && <div className="rounds" aria-hidden="true">{"▮".repeat(cur)}{"▯".repeat(mag - cur)}</div>}
              <KV k={<span className={cx(jams > 0 ? "neg" : "hint")}>{jams >= 3 ? "Клинила: непридатна" : jams > 0 ? `Клинила: −${jams}` : "Клинила"}</span>}>
                <Stepper value={jams} min={0} max={3} set={v => upF(f => { f.weapons[i].jams = v; })} />
              </KV>
            </>}
          </div>
        );
      })}

      <div className="pad sep">
        <div className="row between wrapg">
          <span className="lbl">Лут</span>
          {rollable && <Btn sm title="Зброя, набої й гроші за формулами статблоку" onClick={reroll}>Кинути спорядження</Btn>}
        </div>
        {ammo.map(a => (
          <KV key={a.id} k={a.name}>
            <NumIn className="w6 num" label={a.name} value={num(a.qty)} set={v => upF(f => { const x = f.items.find(y => y.id === a.id); if (x) x.qty = Math.round(v); })} />
          </KV>
        ))}
        {showMoney && <KV k={`Гроші, ${foe.cur}`}>
          <NumIn className="w6 num" label="Гроші" value={foe.money} set={v => upF(f => { f.money = Math.round(v); })} />
        </KV>}
        {loot.map(it => (
          <KV key={it.id} k={it.name}>
            <Stepper value={num(it.qty)} min={0} max={99} set={v => upF(f => { const x = f.items.find(y => y.id === it.id); if (x) x.qty = v; })} />
          </KV>
        ))}
        {entry?.gear.trim() && <div className="pre hint">Завжди має: {entry.gear}</div>}
        {entry?.lootNote.trim() && <div className="pre hint">{entry.lootNote}</div>}
        <Area value={foe.note} rows={2} label="Нотатка про цього ворога" placeholder="нотатка" set={v => upF(f => { f.note = v; })} />
        <div className="row">
          <Confirm sm={false} label="Прибрати з енкаунтера" ask="Точно прибрати?" title="Прибрати з енкаунтера" onConfirm={() => up(e => { removeCombatant(e, foe.id, rea); })} />
        </div>
      </div>
    </Box>
  );
}
