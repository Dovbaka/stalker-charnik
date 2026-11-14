// Pieces shared by several tabs: the health box and the luck buttons.
import { useState } from "react";
import { LUCK_COST, setHp, setLuckPool, spendLuck, takeDamage, worn, type DamageType, type LuckUse } from "../../rules/character";
import { num } from "../../util";
import { Box, Btn, Check, Dots, EditNum, KV, Meter, Stepper, toast } from "../bits";
import type { SheetApi } from "../Sheet";

/** Faint colour bands behind the health bar, so the next colour step can be seen before it is reached. */
function healthTint(max: number, [m1, m2, m3]: [number, number, number]): string {
  const p = (v: number) => (v / (max || 1)) * 100 + "%";
  return `linear-gradient(90deg, rgba(238,90,68,.16) 0 ${p(m3)}, rgba(240,138,60,.16) ${p(m3)} ${p(m2)}, rgba(227,195,74,.14) ${p(m2)} ${p(m1)}, rgba(134,192,106,.12) ${p(m1)} 100%)`;
}

/**
 * Health: the number in its colour, the bar with the wound thresholds, and a field for how much to take off or give back
 * (empty means 1). In combat the damage goes through the worn armour.
 * Nothing in this box appears or disappears when a number changes, so the buttons never move under a finger.
 */
export function HealthBox({ c, d, ro, up, combat }: SheetApi & { combat?: boolean }) {
  const [amt, setAmt] = useState("");
  const [type, setType] = useState<DamageType>("kin");
  const a = worn(c);
  const arm = (k: "kin" | "acid" | "fire" | "elec") => (a ? `, броня ${num(a[k])}` : "");
  const types: [DamageType, string][] = [["kin", "кінетика" + arm("kin")], ["none", "повз броню"], ["acid", "кислота" + arm("acid")], ["fire", "вогонь" + arm("fire")], ["elec", "електрика" + arm("elec")]];
  const amount = () => { const n = Math.round(num(amt, 1)); return n > 0 ? n : 0; };
  const minus = () => {
    const n = amount(); if (!n) return;
    const was = c.hp;
    if (combat && type !== "none") {
      let res = { real: 0, absorbed: 0 };
      const undo = up(x => { res = takeDamage(x, n, type); });
      toast(!res.absorbed ? `−${res.real} ОЗ.` : res.real ? `−${res.real} ОЗ, броня зняла ${res.absorbed}.` : "Броня втримала всю шкоду.", undo);
    } else {
      let now = was;
      const undo = up(x => { setHp(x, x.hp - n); now = x.hp; });
      if (undo) toast(`−${was - now} ОЗ.`, undo);
    }
    setAmt("");
  };
  const plus = () => {
    const n = amount(); setAmt(""); if (!n) return;
    let now = c.hp;
    const undo = up(x => { setHp(x, x.hp + n); now = x.hp; });
    if (undo) toast(`+${now - c.hp} ОЗ.`, undo);
  };
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
          <input className="in w4 num" inputMode="numeric" placeholder="0" aria-label="Скільки" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") minus(); }} />
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

const USES: [LuckUse, string, string][] = [["bonus", "+1 до кидка", "+1 до своєї перевірки або −1 ворогу"], ["reroll", "Перекид", "перекинути к10, свій чи ворожий"], ["auto", "Автоуспіх", "автоуспіх або автопровал ворога"]];
const SPENT: Record<LuckUse, string> = { bonus: "+1 до кидка", reroll: "перекид", auto: "автоуспіх" };

/**
 * Spend luck on its three uses. The number itself can be typed over (0..pool) to undo a slip.
 * The pool changes only in «Редагувати»; luck comes back through «Відпочити».
 */
export function LuckControls({ c, ro, edit, up }: SheetApi) {
  const cur = num(c.luck.cur), pool = num(c.luck.pool);
  const spend = (use: LuckUse) => {
    let ok = false;
    const undo = up(x => { ok = spendLuck(x, use); });
    if (ok) toast(`Удача: ${SPENT[use]}.`, undo);
  };
  return (
    <div className="pad">
      <div className="row between">
        <EditNum value={cur} max={pool} label="Удача зараз" set={v => up(x => { x.luck.cur = v; })} suffix={<small>/{pool}</small>} />
        {pool > 0 && pool <= 12 && <Dots cls="pips" on={cur} of={pool} />}
      </div>
      <div className="luckbtns">
        {USES.map(([use, name, title]) => (
          <button type="button" key={use} className="btn" title={title} disabled={ro || cur < LUCK_COST[use]} onClick={() => spend(use)}>
            <span>{name}</span><small>{LUCK_COST[use]} уд.</small>
          </button>
        ))}
      </div>
      {edit && !ro && <KV k="Пул удачі"><Stepper value={pool} min={0} max={99} set={v => up(x => { const was = num(x.luck.pool); setLuckPool(x, v); if (v > was) x.luck.cur = num(x.luck.cur) + (v - was); })} /></KV>}
    </div>
  );
}
