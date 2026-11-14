import { useState } from "react";
import { GUNS, SKILL_NAME, WEAPON_SKILLS } from "../../rules/data";
import { LUCK_COST, SHOT0, addGun, reload, shotCalc, spendLuck, type ShotOpts } from "../../rules/character";
import type { SkillKey } from "../../rules/types";
import { clamp, d10, num, sign } from "../../util";
import { Box, Btn, Check, Confirm, KV, Lab, NumIn, Stepper, Text, Tg, toast, usePersisted } from "../bits";
import type { SheetApi } from "../Sheet";
import { HealthBox, LuckControls } from "./parts";

export function CombatTab(api: SheetApi) {
  return <>
    <HealthBox {...api} combat />
    {num(api.c.luck.pool) > 0 && <Box title="Удача" ro={api.ro}><LuckControls {...api} restore={false} /></Box>}
    <ShotBox {...api} />
    <GunsBox {...api} />
    <ArmorBox {...api} />
  </>;
}

interface Attempt { how: string; r: number; mod: number; hit: boolean }

/** The shot calculator works on anyone's sheet; luck can only be spent on your own. */
function ShotBox({ c, d, ro, up }: SheetApi) {
  const [o, setO] = usePersisted<ShotOpts>("charnik.shot", SHOT0);
  const [log, setLog] = useState<Attempt[]>([]);
  const [eyeUsed, setEyeUsed] = useState(false);
  const set = (patch: Partial<ShotOpts>) => { setO({ ...o, ...patch }); setLog([]); };
  const m = shotCalc(c, d, o);
  const luck = num(c.luck.cur);
  const pc = (v: number) => Math.round(v * 100) + "%";
  const need = m.need <= 1 ? "1+" : m.need > 10 ? "—" : m.need + "+";
  const flag = (key: "sit" | "optic" | "colim" | "nato" | "lying" | "tprone" | "vis" | "invis", text: string, mod: string) =>
    <Tg on={o[key]} mod={mod} onClick={() => set({ [key]: !o[key] } as Partial<ShotOpts>)}>{text}</Tg>;
  const bump = (key: "rounds" | "jam" | "extra", lo: number, hi: number) =>
    <Stepper value={o[key]} min={lo} max={hi} show={o[key] > 0 ? "+" + o[key] : o[key]} set={v => set({ [key]: v } as Partial<ShotOpts>)} />;

  const spend = (n: number): boolean => {
    if (ro) return false;
    let ok = true;
    up(x => { for (let i = 0; i < n && ok; i++) ok = spendLuck(x, "bonus"); });
    return ok;
  };
  const throwDie = () => {
    if (o.luck > 0) {
      if (ro || luck < o.luck) { toast("Удачі не вистачає."); return; }
      spend(o.luck);
      setO({ ...o, luck: 0 }); // spent: the next shot starts without it
    }
    const r = d10();
    setLog([{ how: "Кидок", r, mod: m.mod, hit: r + m.mod >= 9 }]);
    setEyeUsed(false);
  };
  const first = log[0];
  const missed = log.length > 0 && !log.some(a => a.hit);
  const eye = () => { const r = d10(), mod = first.mod + m.rerollBonus; setLog([...log, { how: `Перекид +${m.rerollBonus}`, r, mod, hit: r + mod >= 9 }]); setEyeUsed(true); };
  const luckReroll = () => {
    let ok = false; up(x => { ok = spendLuck(x, "reroll"); });
    if (!ok) return;
    const r = d10(); setLog([...log, { how: "Перекид за удачу", r, mod: first.mod, hit: r + first.mod >= 9 }]);
  };
  const luckAuto = () => {
    let ok = false; up(x => { ok = spendLuck(x, "auto"); });
    if (ok) setLog([...log, { how: "Автоуспіх за удачу", r: 0, mod: 0, hit: true }]);
  };

  return (
    <Box title="Постріл">
      <div className="pad">
        <div className="seg">{(["rifles", "pistols", "heavy"] as const).map(k => <Tg key={k} on={o.skill === k} mod={String(num(c.skills[k]))} onClick={() => set({ skill: k })}>{SKILL_NAME[k]}</Tg>)}</div>
        <div className="seg"><Tg on={o.shot === "aimed"} onClick={() => set({ shot: "aimed" })}>Прицільний</Tg><Tg on={o.shot === "quick"} mod="−1" onClick={() => set({ shot: "quick" })}>Швидкий</Tg></div>
        <div className="seg"><Tg on={o.near === "far"} onClick={() => set({ near: "far" })}>Далі 10 м</Tg><Tg on={o.near === "10"} mod="+1" onClick={() => set({ near: "10" })}>До 10 м</Tg><Tg on={o.near === "1"} mod="+3" onClick={() => set({ near: "1" })}>До 1 м</Tg></div>
        <div className="seg"><Tg on={o.cover === "0"} onClick={() => set({ cover: "0" })}>Без укриття</Tg><Tg on={o.cover === "1"} mod="−1" onClick={() => set({ cover: "1" })}>Укриття ½</Tg><Tg on={o.cover === "3"} mod="−3" onClick={() => set({ cover: "3" })}>Укриття ¾</Tg></div>
        <div className="seg">
          {o.shot === "aimed" && flag("sit", "Сидячи", "+1")}
          {flag("optic", "Оптика, від 50 м", "+1")}{flag("colim", "Коліматор, до 50 м", "+1")}{flag("nato", "Зброя НАТО", "+1")}
          {flag("lying", "Лежачи", "−2")}{flag("tprone", "Ціль лежить", "−1")}{flag("vis", "Туман, дощ", "−2")}{flag("invis", "Ціль невидима", "−3")}
          <Tg on={c.armor.mask} mod="−1" disabled={ro} onClick={() => { up(x => { x.armor.mask = !x.armor.mask; }); setLog([]); }}>Протигаз</Tg>
        </div>
        <KV k="Раунди по цій цілі">{bump("rounds", 0, 9)}</KV>
        <KV k="Зброя клинила">{bump("jam", 0, 2)}</KV>
        <KV k="Інше">{bump("extra", -9, 9)}</KV>
        {!ro && num(c.luck.pool) > 0 && <KV k={`Удача, +1 за очко (є ${luck})`}><Stepper value={o.luck} min={0} max={Math.min(5, luck)} show={o.luck > 0 ? "+" + o.luck : 0} set={v => set({ luck: v })} /></KV>}
        <div className="result">
          <div className="need">{need}</div>
          <div>
            {m.need <= 1 ? "Влучає завжди." : m.need > 10 ? "Таким кидком не влучити." : <>на к10 · <b>{pc(m.chance)}</b></>}
            {m.reroll && m.need > 1 && <><br />з перекидом +{m.rerollBonus}: <b>{pc(m.chanceReroll)}</b></>}
          </div>
        </div>
        <div className="formula">к10 {m.parts.map(x => `${sign(x[1])} ${x[0]}`).join(" ")}</div>
        <div className="row wrapg"><Btn pri onClick={throwDie}>Кинути к10</Btn><Btn onClick={() => { setO(SHOT0); setLog([]); }}>Скинути</Btn></div>
        {log.length > 0 && (
          <div className="rolllog">
            {log.map((a, i) => (
              <div key={i}>{a.how}{a.r ? `: ${a.r} ${sign(a.mod)} = ${a.r + a.mod}` : ""}. {a.hit ? <b className="pos">Влучання.</b> : <b className="neg">Промах.</b>}</div>
            ))}
            {missed && (
              <div className="row wrapg">
                {m.reroll && !eyeUsed && <Btn sm pri onClick={eye}>Перекид +{m.rerollBonus}</Btn>}
                {!ro && luck >= LUCK_COST.reroll && <Btn sm onClick={luckReroll}>Перекид за удачу<span className="cost">3</span></Btn>}
                {!ro && luck >= LUCK_COST.auto && <Btn sm onClick={luckAuto}>Влучити за удачу<span className="cost">5</span></Btn>}
              </div>
            )}
          </div>
        )}
      </div>
    </Box>
  );
}

function GunsBox({ c, ro, edit, up }: SheetApi) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  const add = () => {
    const g = pick === "" ? undefined : GUNS[Number(pick)];
    if (g && buy && g.p) {
      if (c.money < g.p) { toast(`Не вистачає купонів: треба ${g.p}.`); return; }
      toast(`Куплено: ${g.n}, −${g.p} куп.`);
    }
    up(x => { if (g && buy) x.money -= g.p; addGun(x, g); });
    setAdding(false);
    if (!g) toast("Назву, шкоду й магазин впиши через «Правити».");
  };
  return (
    <Box title="Зброя" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.weapons.length === 0 && !adding && <p className="empty">Зброї немає.</p>}
        {c.weapons.map((g, i) => {
          const mag = num(g.mag), cur = clamp(num(g.cur), 0, mag), jams = num(g.jams);
          const meta = [g.dmg, g.cal, g.nato ? "НАТО +1" : ""].filter(Boolean).join(" · ");
          return (
            <div className="card" key={g.id}>
              <div className="row between">
                <div className="row base wrapg" style={{ minWidth: 0 }}><h3>{g.name}</h3>{meta && <span className="hint num">{meta}</span>}</div>
                {edit && <Confirm onConfirm={() => up(x => { x.weapons.splice(i, 1); })} />}
              </div>
              {mag > 0 && <>
                <div className="row wrapg">
                  <span className="ammo">{cur}/{mag}</span>
                  <Btn onClick={() => { if (cur <= 0) { toast("Магазин порожній."); return; } up(x => { x.weapons[i].cur = cur - 1; }); }}>Постріл</Btn>
                  <Btn pri onClick={() => { let msg = ""; up(x => { msg = reload(x, g.id); }); if (msg) toast(msg); }}>Перезарядити</Btn>
                </div>
                {mag <= 40 && <div className="rounds" aria-hidden="true">{"▮".repeat(cur)}{"▯".repeat(mag - cur)}</div>}
                <KV k={jams >= 3 ? <span className="neg">Непридатна до ремонту</span> : jams > 0 ? <span className="neg">Клинила: −{jams} до влучання й шкоди</span> : <span className="hint">Клинила</span>}>
                  <Stepper value={jams} min={0} max={3} set={v => up(x => { x.weapons[i].jams = v; })} />
                </KV>
              </>}
              {g.note && <div className="hint">{g.note}</div>}
              {edit && (
                <div className="fgrid">
                  <Lab name="Назва" wide><Text value={g.name} set={v => up(x => { x.weapons[i].name = v; })} /></Lab>
                  <Lab name="Навичка"><select className="in" value={g.skill} onChange={e => up(x => { x.weapons[i].skill = e.target.value as SkillKey; })}>{WEAPON_SKILLS.map(k => <option key={k} value={k}>{SKILL_NAME[k]}</option>)}</select></Lab>
                  <Lab name="Шкода"><Text value={g.dmg} placeholder="2к10" set={v => up(x => { x.weapons[i].dmg = v; })} /></Lab>
                  <Lab name="Магазин"><NumIn value={mag} set={v => up(x => { x.weapons[i].mag = v; x.weapons[i].cur = Math.min(x.weapons[i].cur, v); })} /></Lab>
                  <Lab name="Вага, кг"><NumIn value={num(g.w)} set={v => up(x => { x.weapons[i].w = v; })} /></Lab>
                  <Lab name="Калібр"><Text value={g.cal} set={v => up(x => { x.weapons[i].cal = v; })} /></Lab>
                  <Lab name="Режими вогню"><Text value={g.modes} set={v => up(x => { x.weapons[i].modes = v; })} /></Lab>
                  <Lab name="Нотатка" wide><Text value={g.note} set={v => up(x => { x.weapons[i].note = v; })} /></Lab>
                  <Check wide checked={g.nato} set={v => up(x => { x.weapons[i].nato = v; })}>Зброя НАТО, +1 до влучання</Check>
                </div>
              )}
            </div>
          );
        })}
        {adding && (
          <div className="addf">
            <div className="row wrapg">
              <select className="in" aria-label="Яку зброю додати" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">Своя зброя</option>{GUNS.map((g, i) => <option key={g.n} value={i}>{g.n}, {g.p} куп.</option>)}
              </select>
              <Btn pri onClick={add}>Додати</Btn>
              <Btn onClick={() => setAdding(false)}>Скасувати</Btn>
            </div>
            <Check checked={buy} set={setBuy}>Купити: списати купони</Check>
          </div>
        )}
      </div>
    </Box>
  );
}

function ArmorBox({ c, ro, edit, up }: SheetApi) {
  const a = c.armor;
  const tiles: [string, number][] = [["Кінет", a.kin], ["Кисл", a.acid], ["Вогонь", a.fire], ["Елект", a.elec], ["Рад", num(a.rad) + (a.mask ? 5 : 0)]];
  const field = (name: string, key: "kin" | "acid" | "fire" | "elec" | "rad" | "w" | "slots") =>
    <Lab name={name}><NumIn value={num(a[key])} set={v => up(x => { x.armor[key] = v; })} /></Lab>;
  return (
    <Box title="Броня" ro={ro}>
      <div className="pad">
        <b>{a.name}</b>
        <div className="prot">{tiles.map(t => <div key={t[0]}><b>{num(t[1])}</b><span>{t[0]}</span></div>)}</div>
        <Check checked={a.mask} set={v => up(x => { x.armor.mask = v; })}>Протигаз: +5 від радіації, −1 до влучання</Check>
        {edit && (
          <div className="fgrid">
            <Lab name="Назва" wide><Text value={a.name} set={v => up(x => { x.armor.name = v; })} /></Lab>
            {field("Кінетика", "kin")}{field("Кислота", "acid")}{field("Вогонь", "fire")}{field("Електрика", "elec")}{field("Радіація", "rad")}{field("Вага, кг", "w")}{field("Контейнери", "slots")}
            <Check wide checked={a.countW} set={v => up(x => { x.armor.countW = v; })}>Рахувати вагу броні у вантаж</Check>
          </div>
        )}
      </div>
    </Box>
  );
}
