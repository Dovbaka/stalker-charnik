import { useState } from "react";
import { ATTRS, ATTR_WITH, RAD_FX, RAD_STAGE, REROLL_OPTIONS, SKILL_GROUPS } from "../../rules/data";
import { maxHp, setHp, takeDamage, type DamageType } from "../../rules/character";
import type { RerollSkill } from "../../rules/types";
import { clamp, cx, num, sign, uid } from "../../util";
import { Area, Bar, Box, Btn, Check, Confirm, KV, Lab, Stepper, Text, toast } from "../bits";
import type { SheetApi } from "../Sheet";

export function CardTab(api: SheetApi) {
  return <><HpBox {...api} /><EnvBox {...api} /><RollsBox {...api} /><AttrsBox {...api} /><SkillsBox {...api} /><AbilBox {...api} /><IdentBox {...api} /></>;
}

function HpBox({ c, d, ro, up }: SheetApi) {
  const [dmg, setDmg] = useState("");
  const [type, setType] = useState<DamageType>("kin");
  const th = [1, 2, 3].map(k => Math.floor(d.max * (1 - 0.25 * k)));
  const a = c.armor;
  const types: [DamageType, string][] = [["kin", `кінетика, броня ${num(a.kin)}`], ["none", "повз броню"], ["acid", `кислота, броня ${num(a.acid)}`], ["fire", `вогонь, броня ${num(a.fire)}`], ["elec", `електрика, броня ${num(a.elec)}`]];
  const hit = () => {
    const n = Math.round(num(dmg, NaN));
    if (!(n > 0)) { toast("Впиши, скільки шкоди отримано."); return; }
    const arm = type === "none" ? 0 : num(a[type]), real = Math.max(0, n - arm);
    up(x => { takeDamage(x, n, type); });
    setDmg("");
    toast(real ? `−${real} ОЗ` + (arm ? `, броня зняла ${Math.min(arm, n)}.` : ".") : "Броня втримала всю шкоду.");
  };
  const hp = (delta: number) => up(x => setHp(x, x.hp + delta));
  return (
    <Box title="Здоров'я" ro={ro}>
      <div className="pad">
        <div className="row between end">
          <div className={`big ${d.hpCls}`}>{c.hp}<small>/{d.max}</small></div>
          <div className="btns"><Btn onClick={() => hp(-5)}>−5</Btn><Btn onClick={() => hp(-1)}>−1</Btn><Btn onClick={() => hp(1)}>+1</Btn><Btn onClick={() => hp(5)}>+5</Btn></div>
        </div>
        <Bar pct={(c.hp / d.max) * 100} cls={d.hpCls} ticks={[25, 50, 75]} label={`Здоров'я ${c.hp} з ${d.max}`} />
        <div className="hint">Поранення: перше від {th[0]} ОЗ, друге від {th[1]}, третє від {th[2]}. Непритомність на 0, смерть на −{Math.ceil(d.max / 4)}.</div>
        {d.woundText && <div className="neg">{d.woundText}</div>}
        {d.wounds > 0 && <Check checked={c.woundsTreated} set={v => up(x => { x.woundsTreated = v; })}>Рани оброблено, штрафи зняті до нової чверті втрат</Check>}
        <div className="row wrapg">
          <input className="in w4 num" inputMode="numeric" placeholder="0" aria-label="Скільки шкоди" value={dmg} onChange={e => setDmg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") hit(); }} />
          <select className="in" aria-label="Тип шкоди" value={type} onChange={e => setType(e.target.value as DamageType)}>{types.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
          <Btn dng onClick={hit}>Отримати шкоду</Btn>
        </div>
        <KV k="Кровотеча, раундів">
          <span className="row">
            {c.bleed > 0 && <Btn sm dng onClick={() => up(x => { x.bleed--; setHp(x, x.hp - 1); })}>Раунд: −1 ОЗ</Btn>}
            <Stepper value={c.bleed} min={0} max={60} set={v => up(x => { x.bleed = v; })} />
          </span>
        </KV>
      </div>
    </Box>
  );
}

function EnvBox({ c, d, ro, up }: SheetApi) {
  const rad = (delta: number) => up(x => { x.rad = clamp(x.rad + delta, 0, 1000); });
  return (
    <Box title="Радіація й побут" ro={ro}>
      <div className="pad">
        <div className="row between end">
          <div className="big amber">{c.rad}<small> рад</small></div>
          <div className="btns"><Btn onClick={() => rad(-25)}>−25</Btn><Btn onClick={() => rad(-1)}>−1</Btn><Btn onClick={() => rad(5)}>+5</Btn><Btn onClick={() => rad(10)}>+10</Btn><Btn onClick={() => rad(25)}>+25</Btn></div>
        </div>
        <Bar pct={c.rad / 10} cls="rad" ticks={[10, 30, 50, 80]} label={`Радіація ${c.rad} з 1000 рад`} />
        <div className={d.radStage ? "neg" : "hint"}>Стадія: {RAD_STAGE[d.radStage].toLowerCase()}, {RAD_FX[d.radStage]}.</div>
        <div className="sep" />
        <KV k="Горілка в крові, пляшок"><Stepper value={c.vodka} min={0} max={9} set={v => up(x => { x.vodka = v; })} /></KV>
        {d.vodkaOut ? <div className="neg">Характеристика впала до 0: непритомність. Щогодини повертається по 1.</div>
          : c.vodka > 0 && d.nextVodkaOut ? <div className="hint">Ще одна пляшка зведе характеристику до 0.</div> : null}
        <KV k="Без сну, діб"><Stepper value={c.noSleep} min={0} max={3} set={v => up(x => { x.noSleep = v; })} /></KV>
        <KV k="Без їжі, днів"><Stepper value={c.noFood} min={0} max={9} set={v => up(x => { x.noFood = v; })} /></KV>
        <KV k="Без води, днів"><Stepper value={c.noWater} min={0} max={9} set={v => up(x => { x.noWater = v; })} /></KV>
        <Lab name="Травми й ускладнення"><Text value={c.conditions} set={v => up(x => { x.conditions = v; })} placeholder="Наприклад: поранена ліва нога, рух −2 м" /></Lab>
      </div>
    </Box>
  );
}

function RollsBox({ c, d, ro }: SheetApi) {
  const p = d.checkPen, e = d.eff;
  const det = Math.round(clamp((e.spy + p + 5) / 10, 0, 1) * 100), mv = 3 + e.spr;
  const rows: [string, string][] = [
    ["Ініціатива", `к10 ${sign(e.rea + p)}`],
    ["Виявлення, треба 6+", `к10 ${sign(e.spy + p)} · ${det}%`],
    ["Ухилення", `к10 ${sign(e.spr + num(c.skills.athletics) + p)}`],
    ["Скрадання", `к10 ${sign(e.spr + num(c.skills.stealth) + p)}`],
    ["Рух / ривок / повзком", `${mv} / ${mv * 2} / ${e.spr} м`],
    ["Сила", String(e.til)],
  ];
  return (
    <Box title="Кидки й рух" ro={ro}>
      <div className="pad">
        {rows.map(r => <KV key={r[0]} k={r[0]}><span className="num">{r[1]}</span></KV>)}
        {p !== 0 && <div className="neg">Рани дають {p} до всіх перевірок. У цифрах вище це вже враховано.</div>}
      </div>
    </Box>
  );
}

function AttrsBox({ c, d, ro, edit, up }: SheetApi) {
  return (
    <Box title="Характеристики" ro={ro}>
      <div>
        {ATTRS.map(a => {
          const k = a.key, base = num(c.attrs[k]), v = d.eff[k], mod = num(c.attrMod[k]);
          return (
            <div className="arow" key={k}>
              <div className="an">
                <h3>{a.name}</h3>
                <div className="hint">{a.short}</div>
                {(d.lines[k].length > 0 || d.halves[k].length > 0) && (
                  <div className="chips">
                    {d.lines[k].map(([src, val]) => <span key={src} className={cx("chip", val < 0 ? "neg" : "pos")}>{src} {val > 0 ? "+" : "−"}{Math.abs(val)}</span>)}
                    {d.halves[k].map(h => <span key={h} className="chip neg">{h} ÷2</span>)}
                  </div>
                )}
                {edit && (
                  <div className="edrow">
                    <span>база</span><Stepper value={base} min={1} max={12} set={n => up(x => { x.attrs[k] = n; x.hp = Math.min(x.hp, maxHp(x)); })} />
                    <span>артефакти й інше</span><Stepper value={mod} min={-9} max={9} show={mod > 0 ? "+" + mod : mod} set={n => up(x => { x.attrMod[k] = n; })} />
                  </div>
                )}
              </div>
              <div className={cx("av", v < base && "neg", v > base && "pos")}>{v}{v !== base && <small>база {base}</small>}</div>
            </div>
          );
        })}
      </div>
    </Box>
  );
}

function SkillsBox({ c, d, ro, edit, up }: SheetApi) {
  const p = d.checkPen;
  return (
    <Box title="Навички" ro={ro}>
      <div>
        {SKILL_GROUPS.map(g => (
          <div className="sg" key={g.name}>
            <div className="lbl">{g.name}</div>
            {g.skills.map(s => {
              const lvl = num(c.skills[s.key]);
              const hint = lvl > 0 ? (s.attr ? `к10 ${sign(lvl + d.eff[s.attr] + p)} ${ATTR_WITH[s.attr]}` : `к10 ${sign(lvl + p)}`) : "";
              return (
                <div className={cx("srow", !lvl && "zero")} key={s.key}>
                  <span className="sn">{lvl ? <b>{s.name}</b> : s.name}{hint && <span className="sh hint num">{hint}</span>}</span>
                  {edit ? <Stepper value={lvl} min={0} max={10} set={n => up(x => { x.skills[s.key] = n; })} />
                    : <><span className="pips" aria-hidden="true">{"●".repeat(Math.min(lvl, 6))}{"○".repeat(Math.max(0, 5 - lvl))}</span><span className="sv num">{lvl}</span></>}
                </div>
              );
            })}
          </div>
        ))}
        <div className="sg">
          <KV k="Знання Зони"><Stepper value={c.zone} min={0} max={10} set={n => up(x => { x.zone = n; })} /></KV>
          <div style={{ height: 8 }} />
          <KV k="Вільні бали навичок"><Stepper value={c.freeSkill} min={0} max={99} set={n => up(x => { x.freeSkill = n; })} /></KV>
          <div style={{ height: 8 }} />
          <KV k="Вільні бали характеристик"><Stepper value={c.freeAttr} min={0} max={99} set={n => up(x => { x.freeAttr = n; })} /></KV>
          {edit && <div className="hint" style={{ marginTop: 8 }}>Рівень N коштує N балів, рівні беруться по черзі.</div>}
        </div>
      </div>
    </Box>
  );
}

function AbilBox({ c, ro, edit, up }: SheetApi) {
  const rr = c.reroll ?? { skill: "", bonus: 2 };
  const rrName = (REROLL_OPTIONS.find(o => o[0] === rr.skill) ?? REROLL_OPTIONS[0])[1];
  return (
    <Box title="Здібності" ro={ro}>
      <div>
        {c.abilities.length === 0 && <p className="empty">Здібностей поки немає. Майстер дає їх за передісторію.</p>}
        {c.abilities.map((a, i) => (
          <div className="card" key={a.id}>
            <div className="row between"><h3 className="abn">{a.name || "Без назви"}</h3>{edit && <Confirm onConfirm={() => up(x => { x.abilities.splice(i, 1); })} />}</div>
            {a.text && <p>{a.text}</p>}
            {edit && (
              <div className="fgrid">
                <Lab name="Назва" wide><Text value={a.name} set={v => up(x => { x.abilities[i].name = v; })} /></Lab>
                <Lab name="Що робить" wide><Area value={a.text} set={v => up(x => { x.abilities[i].text = v; })} /></Lab>
              </div>
            )}
          </div>
        ))}
        {edit ? (
          <div className="addf">
            <div><Btn pri onClick={() => up(x => { x.abilities.push({ id: uid(), name: "", text: "" }); })}>Додати здібність</Btn></div>
            <div className="lbl">Перекид промаху в калькуляторі пострілу</div>
            <div className="row wrapg">
              <select className="in" aria-label="Для якої зброї" value={rr.skill} onChange={e => up(x => { x.reroll.skill = e.target.value as RerollSkill; })}>{REROLL_OPTIONS.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              <span className="row hint">бонус <Stepper value={num(rr.bonus)} min={0} max={9} show={"+" + num(rr.bonus)} set={n => up(x => { x.reroll.bonus = n; })} /></span>
            </div>
          </div>
        ) : rr.skill ? <div className="pad hint">Калькулятор пострілу рахує перекид промаху з +{num(rr.bonus)}: {rrName}.</div> : null}
      </div>
    </Box>
  );
}

function IdentBox({ c, ro, edit, up }: SheetApi) {
  const i = c.id;
  if (edit) {
    return (
      <Box title="Особова справа" ro={ro}>
        <div className="pad"><div className="fgrid">
          <Lab name="Позивний"><Text value={i.callsign} set={v => up(x => { x.id.callsign = v; })} /></Lab>
          <Lab name="Ім'я"><Text value={i.name} set={v => up(x => { x.id.name = v; })} /></Lab>
          <Lab name="Заняття"><Text value={i.role} set={v => up(x => { x.id.role = v; })} /></Lab>
          <Lab name="Вік"><Text value={i.age} set={v => up(x => { x.id.age = v; })} /></Lab>
          <Lab name="Зовнішність" wide><Area value={i.looks} set={v => up(x => { x.id.looks = v; })} /></Lab>
          <Lab name="Коротко про себе" wide><Area rows={3} value={i.about} set={v => up(x => { x.id.about = v; })} /></Lab>
        </div></div>
      </Box>
    );
  }
  const rows: [string, string][] = [["Позивний", i.callsign], ["Ім'я", i.name], ["Заняття", i.role], ["Вік", i.age]];
  return (
    <Box title="Особова справа" ro={ro}>
      <div className="pad">
        {rows.filter(r => r[1]).map(r => <div className="kv" key={r[0]}><span className="lbl">{r[0]}</span><span>{r[1]}</span></div>)}
        {i.looks && <div><div className="lbl">Зовнішність</div><p>{i.looks}</p></div>}
        {i.about && <div><div className="lbl">Про себе</div><p>{i.about}</p></div>}
        {!i.looks && !i.about && !ro && <p className="hint">Зовнішність і кілька слів про себе можна дописати через «Правити».</p>}
      </div>
    </Box>
  );
}
