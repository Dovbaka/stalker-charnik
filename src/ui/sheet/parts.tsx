// Pieces shared by several tabs: the health box and the luck buttons.
import { useState } from "react";
import { LUCK_COST, dawnLuck, setHp, setLuckPool, spendLuck, takeDamage, type DamageType, type LuckUse } from "../../rules/character";
import { num } from "../../util";
import { Box, Btn, Check, Dots, KV, Meter, Stepper, toast } from "../bits";
import type { SheetApi } from "../Sheet";

/** Faint colour bands behind the health bar, so the next colour step can be seen before it is reached. */
function healthTint(max: number, [m1, m2, m3]: [number, number, number]): string {
  const p = (v: number) => (v / (max || 1)) * 100 + "%";
  return `linear-gradient(90deg, rgba(238,90,68,.16) 0 ${p(m3)}, rgba(240,138,60,.16) ${p(m3)} ${p(m2)}, rgba(227,195,74,.14) ${p(m2)} ${p(m1)}, rgba(134,192,106,.12) ${p(m1)} 100%)`;
}

/** Health: the number in its colour, −/+ and the bar with the wound thresholds. In combat it also takes damage and bleeding. */
export function HealthBox({ c, d, ro, up, combat }: SheetApi & { combat?: boolean }) {
  const [dmg, setDmg] = useState("");
  const [type, setType] = useState<DamageType>("kin");
  const a = c.armor;
  const types: [DamageType, string][] = [["kin", `кінетика, броня ${num(a.kin)}`], ["none", "повз броню"], ["acid", `кислота, броня ${num(a.acid)}`], ["fire", `вогонь, броня ${num(a.fire)}`], ["elec", `електрика, броня ${num(a.elec)}`]];
  const hp = (delta: number) => up(x => setHp(x, x.hp + delta));
  const hit = () => {
    const n = Math.round(num(dmg, NaN));
    if (!(n > 0)) { toast("Впиши, скільки шкоди отримано."); return; }
    let res = { real: 0, absorbed: 0 };
    up(x => { res = takeDamage(x, n, type); });
    setDmg("");
    toast(res.real ? `−${res.real} ОЗ` + (res.absorbed ? `, броня зняла ${res.absorbed}.` : ".") : "Броня втримала всю шкоду.");
  };
  return (
    <Box title="Здоров'я" ro={ro}>
      <div className="pad">
        <div className="hprow">
          <div className="row base" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className={`hpnum l${d.level}`}>{c.hp}<small>/{d.max}</small></span>
            {d.checkPen !== 0 && <span className={`pen l${d.level}`}>{d.checkPen} до перевірок</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Btn sq aria-label="Менше здоров'я" onClick={() => hp(-1)}>−</Btn>
            <Btn sq aria-label="Більше здоров'я" onClick={() => hp(1)}>+</Btn>
          </div>
        </div>
        <Meter value={c.hp} max={d.max} cls={`l${d.level}`} marks={[...d.marks].reverse()} tint={healthTint(d.max, d.marks)}
          label={`Здоров'я ${c.hp} з ${d.max}. Поранення від ${d.marks.join(", ")}, смерть на ${d.deathAt}.`} />
        {d.wounds > 0 && <Check checked={c.woundsTreated} set={v => up(x => { x.woundsTreated = v; })}>Рани оброблено</Check>}
        {combat && <>
          <div className="row wrapg">
            <input className="in w4 num" inputMode="numeric" placeholder="0" aria-label="Скільки шкоди" value={dmg} onChange={e => setDmg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") hit(); }} />
            <select className="in" aria-label="Тип шкоди" value={type} onChange={e => setType(e.target.value as DamageType)}>{types.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
            <Btn dng onClick={hit}>Шкода</Btn>
          </div>
          <KV k="Кровотеча, раундів">
            <span className="row">
              {c.bleed > 0 && <Btn sm dng onClick={() => up(x => { x.bleed--; setHp(x, x.hp - 1); })}>Раунд −1</Btn>}
              <Stepper value={c.bleed} min={0} max={60} set={v => up(x => { x.bleed = v; })} />
            </span>
          </KV>
        </>}
      </div>
    </Box>
  );
}

const USES: [LuckUse, string, string][] = [["bonus", "±1", "+1 до перевірки або −1 ворогу"], ["reroll", "Перекид", "перекинути к10, свій чи ворожий"], ["auto", "Автоуспіх", "автоуспіх або автопровал ворога"]];
const SPENT: Record<LuckUse, string> = { bonus: "±1 до перевірки", reroll: "перекид", auto: "автоуспіх" };

/** Spend luck for its three uses, get it back at dawn, set the pool. */
export function LuckControls({ c, ro, up, restore = true }: SheetApi & { restore?: boolean }) {
  const cur = num(c.luck.cur), pool = num(c.luck.pool);
  const spend = (use: LuckUse) => {
    let ok = false;
    up(x => { ok = spendLuck(x, use); });
    if (ok) toast(`Удача: ${SPENT[use]}.`);
  };
  const dawn = (safe: boolean) => {
    let got = 0;
    up(x => { got = dawnLuck(x, safe); });
    toast(got ? `Удача +${got}.` : "Удача й так повна.");
  };
  return (
    <div className="pad">
      <div className="row between">
        <span className="big">{cur}<small>/{pool}</small></span>
        {pool > 0 && pool <= 12 && <Dots cls="pips" on={cur} of={pool} />}
      </div>
      <div className="row wrapg">
        {USES.map(([use, name, title]) => <Btn key={use} title={title} disabled={ro || cur < LUCK_COST[use]} onClick={() => spend(use)}>{name}<span className="cost">{LUCK_COST[use]}</span></Btn>)}
      </div>
      {restore && <>
        <div className="row wrapg">
          <Btn disabled={ro || cur >= pool} onClick={() => dawn(false)}>Світанок +2</Btn>
          <Btn disabled={ro || cur >= pool} onClick={() => dawn(true)}>У безпеці +3</Btn>
        </div>
        {!ro && <KV k="Пул удачі"><Stepper value={pool} min={0} max={99} set={v => up(x => { const was = num(x.luck.pool); setLuckPool(x, v); if (v > was) x.luck.cur = num(x.luck.cur) + (v - was); })} /></KV>}
      </>}
    </div>
  );
}
