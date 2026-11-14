import { useState } from "react";
import { GUNS, SKILL_NAME, WEAPON_SKILLS } from "../../rules/data";
import { SHOT0, addGun, reload, shotCalc, type ShotOpts } from "../../rules/character";
import type { SkillKey } from "../../rules/types";
import { clamp, d10, kg, num, sign } from "../../util";
import { Box, Btn, Check, Confirm, KV, Lab, NumIn, Stepper, Text, Tg, toast, usePersisted } from "../bits";
import type { SheetApi } from "../Sheet";

export function CombatTab(api: SheetApi) {
  return <><ShotBox {...api} /><GunsBox {...api} /><ArmorBox {...api} /><ActionsBox {...api} /></>;
}

interface Roll { r: number; mod: number; hit: boolean; reroll: boolean; rb: number; r2?: number; hit2?: boolean }

/** The shot calculator works on anyone's sheet: it changes nothing but the gas-mask switch. */
function ShotBox({ c, d, ro, up }: SheetApi) {
  const [o, setO] = usePersisted<ShotOpts>("charnik.shot", SHOT0);
  const [roll, setRoll] = useState<Roll | null>(null);
  const set = (patch: Partial<ShotOpts>) => { setO({ ...o, ...patch }); setRoll(null); };
  const m = shotCalc(c, d, o);
  const pc = (v: number) => Math.round(v * 100) + "%";
  const need = m.need <= 1 ? "1+" : m.need > 10 ? "—" : m.need + "+";
  const formula = "к10 " + m.parts.map(x => `${sign(x[1])} (${x[0]})`).join(" ") + ` = к10 ${sign(m.mod)}, влучає на 9+`;
  const flag = (key: "sit" | "optic" | "colim" | "nato" | "lying" | "tprone" | "vis" | "invis", text: string, mod: string) =>
    <Tg on={o[key]} mod={mod} onClick={() => set({ [key]: !o[key] } as Partial<ShotOpts>)}>{text}</Tg>;
  const bump = (key: "rounds" | "jam" | "extra", lo: number, hi: number) =>
    <Stepper value={o[key]} min={lo} max={hi} show={o[key] > 0 ? "+" + o[key] : o[key]} set={v => set({ [key]: v } as Partial<ShotOpts>)} />;
  const throwDie = () => { const r = d10(); setRoll({ r, mod: m.mod, hit: r + m.mod >= 9, reroll: m.reroll, rb: m.rerollBonus }); };
  const again = () => { if (!roll || roll.hit || roll.r2 != null) return; const r2 = d10(); setRoll({ ...roll, r2, hit2: r2 + roll.mod + roll.rb >= 9 }); };
  const verdict = (hit: boolean) => hit ? <b className="pos">Влучання.</b> : <b className="neg">Промах.</b>;

  return (
    <Box title="Постріл">
      <div className="pad">
        <div className="seg">{(["rifles", "pistols", "heavy"] as const).map(k => <Tg key={k} on={o.skill === k} mod={String(num(c.skills[k]))} onClick={() => set({ skill: k })}>{SKILL_NAME[k]}</Tg>)}</div>
        <div className="seg"><Tg on={o.shot === "aimed"} mod="основна дія" onClick={() => set({ shot: "aimed" })}>Прицільний</Tg><Tg on={o.shot === "quick"} mod="−1" onClick={() => set({ shot: "quick" })}>Швидкий</Tg></div>
        <div className="seg"><Tg on={o.near === "far"} onClick={() => set({ near: "far" })}>Ціль далі 10 м</Tg><Tg on={o.near === "10"} mod="+1" onClick={() => set({ near: "10" })}>До 10 м</Tg><Tg on={o.near === "1"} mod="+3" onClick={() => set({ near: "1" })}>До 1 м</Tg></div>
        <div className="seg"><Tg on={o.cover === "0"} onClick={() => set({ cover: "0" })}>Без укриття</Tg><Tg on={o.cover === "1"} mod="−1" onClick={() => set({ cover: "1" })}>Укриття ½</Tg><Tg on={o.cover === "3"} mod="−3" onClick={() => set({ cover: "3" })}>Укриття ¾</Tg></div>
        <div className="seg">
          {o.shot === "aimed" && flag("sit", "Сидячи", "+1")}
          {flag("optic", "Оптика, від 50 м", "+1")}{flag("colim", "Коліматор, до 50 м", "+1")}{flag("nato", "Зброя НАТО", "+1")}
          {flag("lying", "Лежачи", "−2")}{flag("tprone", "Ціль лежить", "−1")}{flag("vis", "Туман, дощ", "−2")}{flag("invis", "Ціль невидима", "−3")}
          <Tg on={c.armor.mask} mod="−1" disabled={ro} onClick={() => { up(x => { x.armor.mask = !x.armor.mask; }); setRoll(null); }}>Протигаз надіто</Tg>
        </div>
        <KV k="Раунди по тій самій цілі після першого">{bump("rounds", 0, 9)}</KV>
        <KV k="Зброя вже клинила, разів">{bump("jam", 0, 2)}</KV>
        <KV k="Інший бонус чи штраф">{bump("extra", -9, 9)}</KV>
        <div className="result">
          <div className="need">{need}</div>
          <div>
            {m.need <= 1 ? "Влучає завжди." : m.need > 10 ? "Таким кидком не влучити." : <>на к10 · <b>{pc(m.chance)}</b></>}
            {m.reroll && m.need > 1 && <><br />з перекидом +{m.rerollBonus}: <b>{pc(m.chanceReroll)}</b></>}
          </div>
        </div>
        <div className="hint num">{formula}</div>
        <div className="row wrapg"><Btn pri onClick={throwDie}>Кинути к10</Btn><Btn onClick={() => { setO(SHOT0); setRoll(null); }}>Скинути умови</Btn></div>
        {roll && (
          <div className="rollout">
            Випало {roll.r}: {roll.r} {sign(roll.mod)} = {roll.r + roll.mod}. {verdict(roll.hit)}
            {!roll.hit && roll.reroll && roll.r2 == null && <> <Btn sm pri onClick={again}>Перекинути з +{roll.rb}</Btn></>}
            {roll.r2 != null && <> Перекид, випало {roll.r2}: {roll.r2} {sign(roll.mod + roll.rb)} = {roll.r2 + roll.mod + roll.rb}. {verdict(!!roll.hit2)}</>}
          </div>
        )}
      </div>
    </Box>
  );
}

function GunsBox({ c, ro, edit, up }: SheetApi) {
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  const add = () => {
    const g = pick === "" ? undefined : GUNS[Number(pick)];
    if (g && buy && g.p) {
      if (c.money < g.p) { toast(`Не вистачає купонів: треба ${g.p}.`); return; }
      toast(`Куплено: ${g.n}, −${g.p} куп.`);
    }
    up(x => { if (g && buy) x.money -= g.p; addGun(x, g); });
    if (!g) toast("Натисни «Правити» вгорі й впиши назву, шкоду та магазин.");
  };
  return (
    <Box title="Зброя" ro={ro}>
      <div>
        {c.weapons.length === 0 && <p className="empty">Зброї ще немає. Додай її зі списку майстра або впиши свою.</p>}
        {c.weapons.map((g, i) => {
          const mag = num(g.mag), cur = clamp(num(g.cur), 0, mag), jams = num(g.jams);
          const meta = [`${SKILL_NAME[g.skill] ?? ""} ${num(c.skills[g.skill])}`, g.dmg ? "шкода " + g.dmg : "", g.cal, g.modes, kg(num(g.w)) + " кг", g.nato ? "НАТО +1" : ""].filter(Boolean).join(" · ");
          return (
            <div className="card" key={g.id}>
              <div className="row between"><h3>{g.name}</h3><Confirm onConfirm={() => up(x => { x.weapons.splice(i, 1); })} /></div>
              <div className="hint num">{meta}</div>
              {mag > 0 && <>
                <div className="row wrapg">
                  <span className="ammo num">{cur}/{mag}</span>
                  <Btn onClick={() => { if (cur <= 0) { toast("Магазин порожній."); return; } up(x => { x.weapons[i].cur = cur - 1; }); }}>Постріл −1</Btn>
                  <Btn pri onClick={() => { let msg = ""; up(x => { msg = reload(x, g.id); }); if (msg) toast(msg); }}>Перезарядити</Btn>
                </div>
                {mag <= 40 && <div className="rounds" aria-hidden="true">{"▮".repeat(cur)}{"▯".repeat(mag - cur)}</div>}
                <KV k="Клинила, разів"><Stepper value={jams} min={0} max={3} set={v => up(x => { x.weapons[i].jams = v; })} /></KV>
                {jams > 0 && <div className="neg">{jams >= 3 ? "Зброя непридатна до повного ремонту." : `−${jams} до влучності й шкоди.`}</div>}
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
        <div className="addf">
          <div className="row wrapg">
            <select className="in" aria-label="Яку зброю додати" value={pick} onChange={e => setPick(e.target.value)}>
              <option value="">Своя зброя</option>{GUNS.map((g, i) => <option key={g.n} value={i}>{g.n}, {g.p} куп.</option>)}
            </select>
            <Btn pri onClick={add}>Додати</Btn>
          </div>
          <Check checked={buy} set={setBuy}>Купити: списати купони</Check>
        </div>
      </div>
    </Box>
  );
}

function ArmorBox({ c, ro, edit, up }: SheetApi) {
  const a = c.armor;
  const tiles: [string, number][] = [["Кінетика", a.kin], ["Кислота", a.acid], ["Вогонь", a.fire], ["Електрика", a.elec], ["Радіація", num(a.rad) + (a.mask ? 5 : 0)]];
  const field = (name: string, key: "kin" | "acid" | "fire" | "elec" | "rad" | "w" | "slots") =>
    <Lab name={name}><NumIn value={num(a[key])} set={v => up(x => { x.armor[key] = v; })} /></Lab>;
  return (
    <Box title="Броня" ro={ro}>
      <div className="pad">
        <h3 style={{ fontSize: 16 }}>{a.name}</h3>
        <div className="prot">{tiles.map(t => <div key={t[0]}><b>{num(t[1])}</b><span>{t[0]}</span></div>)}</div>
        <div className="hint">Вага {kg(num(a.w))} кг{a.countW ? "" : ", у вантаж не рахується"}. Контейнерів для артефактів: {num(a.slots)}.</div>
        <Check checked={a.mask} set={v => up(x => { x.armor.mask = v; })}>Протигаз надіто: +5 від радіації, −1 до влучання</Check>
        {edit ? (
          <div className="fgrid">
            <Lab name="Назва" wide><Text value={a.name} set={v => up(x => { x.armor.name = v; })} /></Lab>
            {field("Кінетика", "kin")}{field("Кислота", "acid")}{field("Вогонь", "fire")}{field("Електрика", "elec")}{field("Радіація", "rad")}{field("Вага, кг", "w")}{field("Контейнери", "slots")}
            <Check wide checked={a.countW} set={v => up(x => { x.armor.countW = v; })}>Рахувати вагу броні у вантаж</Check>
          </div>
        ) : !ro && <p className="hint">Іншу броню можна вписати через «Правити».</p>}
      </div>
    </Box>
  );
}

function ActionsBox({ c, d }: SheetApi) {
  const quick = (k: SkillKey) => Math.round(clamp((num(c.skills[k]) + d.eff.spr) / 10, 0, 1) * 100);
  return (
    <Box title="Дії в бою">
      <div className="ref">
        <p>За хід: одна основна дія або дві додаткові, вільних скільки завгодно. Жодну дію не повторюють двічі за хід.</p>
        <div><h3>Основні</h3><p className="hint">Прицільний постріл чи кидок, ривок, дістати гвинтівку, перезарядка, захват, зламати замок, використати інструмент, прицільний удар, ремонт зброї.</p></div>
        <div><h3>Додаткові</h3><p className="hint">Швидкий постріл, рух, швидко вихопити гвинтівку, швидка перезарядка, дістати пістолет чи ніж, перша допомога, випити або вколоти, швидкий удар, швидкий кидок, швидкий ремонт.</p></div>
        <div><h3>Вільні</h3><p className="hint">Помітити ворога, встати, сісти або впасти, швидко вихопити малу зброю, розмова.</p></div>
        <div><h3>Швидке вихоплювання</h3><p className="hint num">к10 − Спритність має бути не більше за навичку зброї. Зараз: гвинтівка {quick("rifles")}%, пістолет {quick("pistols")}%.</p></div>
        <p className="hint">Дія у відповідь: притримай дію і перерви хід того, в кого ініціатива нижча. Між раундами вона не зберігається.</p>
      </div>
    </Box>
  );
}
