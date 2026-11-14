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

/**
 * Health: the number in its colour, the bar with the wound thresholds, and a field for how much to take off or give back
 * (empty means 1). In combat the damage goes through the chosen armour, and bleeding is counted down here.
 * Nothing in this box appears or disappears when a number changes, so the buttons never move under a finger.
 */
export function HealthBox({ c, d, ro, up, combat }: SheetApi & { combat?: boolean }) {
  const [amt, setAmt] = useState("");
  const [type, setType] = useState<DamageType>("kin");
  const a = c.armor;
  const types: [DamageType, string][] = [["kin", `кінетика, броня ${num(a.kin)}`], ["none", "повз броню"], ["acid", `кислота, броня ${num(a.acid)}`], ["fire", `вогонь, броня ${num(a.fire)}`], ["elec", `електрика, броня ${num(a.elec)}`]];
  const amount = () => { const n = Math.round(num(amt, 1)); return n > 0 ? n : 0; };
  const minus = () => {
    const n = amount(); if (!n) return;
    if (combat && type !== "none") {
      let res = { real: 0, absorbed: 0 };
      up(x => { res = takeDamage(x, n, type); });
      if (res.absorbed) toast(res.real ? `−${res.real} ОЗ, броня зняла ${res.absorbed}.` : "Броня втримала всю шкоду.");
    } else up(x => setHp(x, x.hp - n));
    setAmt("");
  };
  const plus = () => { const n = amount(); if (n) up(x => setHp(x, x.hp + n)); setAmt(""); };
  return (
    <Box title="Здоров'я" ro={ro}>
      <div className="pad">
        <div className="hprow">
          <span className={`hpnum l${d.level}`}>{c.hp}<small>/{d.max}</small></span>
          <span className={`pen l${d.level}`} style={{ visibility: d.checkPen ? "visible" : "hidden" }}>{d.checkPen || "−0"} до перевірок</span>
        </div>
        <Meter value={c.hp} max={d.max} cls={`l${d.level}`} marks={[...d.marks].reverse()} tint={healthTint(d.max, d.marks)}
          label={`Здоров'я ${c.hp} з ${d.max}. Поранення від ${d.marks.join(", ")}, смерть на ${d.deathAt}.`} />
        <div className="hpctl">
          {combat && <select className="in" aria-label="Чим поранено" value={type} onChange={e => setType(e.target.value as DamageType)}>{types.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>}
          <input className="in w4 num" inputMode="numeric" placeholder="1" aria-label="Скільки" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") minus(); }} />
          <Btn sq dng aria-label={combat ? "Отримати шкоду" : "Відняти здоров'я"} title={combat ? "Шкода" : "Відняти"} onClick={minus}>−</Btn>
          <Btn sq aria-label="Додати здоров'я" title="Додати" onClick={plus}>+</Btn>
        </div>
        <Check disabled={d.wounds === 0} checked={c.woundsTreated && d.wounds > 0} set={v => up(x => { x.woundsTreated = v; })}>Рани оброблено</Check>
        {combat && (
          <KV k="Кровотеча, раундів">
            <span className="row">
              <Btn sm dng disabled={c.bleed <= 0} onClick={() => up(x => { x.bleed--; setHp(x, x.hp - 1); })}>Раунд −1</Btn>
              <Stepper value={c.bleed} min={0} max={60} set={v => up(x => { x.bleed = v; })} />
            </span>
          </KV>
        )}
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
