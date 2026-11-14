import { useState } from "react";
import { ATTRS, RAD_FX, RAD_STAGE, REROLL_OPTIONS, SKILL_GROUPS, SKILL_KEYS } from "../../rules/data";
import { maxHp, setLuckPool } from "../../rules/character";
import type { AttrKey, RerollSkill } from "../../rules/types";
import { clamp, cx, num, uid } from "../../util";
import { Area, Box, Btn, Clover, Confirm, Dots, EditNum, KV, Lab, Meter, Stepper, Steps, Text, Trefoil } from "../bits";
import type { SheetApi } from "../Sheet";
import { HealthBox, LuckControls } from "./parts";

export function CardTab(api: SheetApi) {
  // three fixed columns: opening a panel in one never moves boxes in another
  return <>
    <div className="col"><Vitals {...api} /></div>
    <div className="col"><AttrsBox {...api} /><SkillsBox {...api} /></div>
    <div className="col"><CondBox {...api} /><AbilBox {...api} /></div>
  </>;
}

/** Health, then three quick numbers. Radiation and luck open their controls under the row. */
function Vitals(api: SheetApi) {
  const { c, d, ro, up } = api;
  const [open, setOpen] = useState<"" | "rad" | "luck" | "move">("");
  const toggle = (k: "rad" | "luck" | "move") => setOpen(open === k ? "" : k);
  const spr = d.eff.spr, move = 3 + spr, crawl = Math.ceil(move / 2);
  const rad = (delta: number) => up(x => { x.rad = clamp(x.rad + delta, 0, 1000); });
  const pool = num(c.luck.pool), cur = num(c.luck.cur);
  return (
    <div className="stack">
      <HealthBox {...api} />
      <div className="trio">
        <button type="button" className={cx("cell", open === "rad" && "on")} aria-expanded={open === "rad"} onClick={() => toggle("rad")}>
          <span className="cell-h"><span className="lbl">Радіація</span><Trefoil className="ico rad" /></span>
          <span className={cx("v", (c.rad > 0 || d.radStage > 0) && "amber")}>{c.rad}</span>
        </button>
        <button type="button" className={cx("cell", open === "luck" && "on")} aria-expanded={open === "luck"} onClick={() => toggle("luck")}>
          <span className="cell-h"><span className="lbl">Удача</span><Clover className="ico luck" /></span>
          <span className="v">{cur}<small>/{pool}</small></span>
          {pool > 0 && pool <= 12 && <Dots cls="pips" on={cur} of={pool} />}
        </button>
        <button type="button" className={cx("cell", open === "move" && "on")} aria-expanded={open === "move"} onClick={() => toggle("move")}>
          <span className="cell-h"><span className="lbl">Швидкість</span><Steps className="ico move" /></span>
          <span className={cx("v", spr < num(c.attrs.spr) && "neg")}>{move}<small> м</small></span>
        </button>
      </div>
      {open === "rad" && (
        <Box title="Радіація" ro={ro}>
          <div className="pad">
            <EditNum value={c.rad} max={1000} label="Радіація зараз" className="amber" set={v => up(x => { x.rad = v; })} suffix={<small> рад</small>} />
            <div className="row wrapg">
              {[-25, -1, 1, 5, 10, 25].map(n => <Btn key={n} onClick={() => rad(n)}>{n > 0 ? "+" + n : "−" + -n}</Btn>)}
            </div>
            <Meter value={c.rad} max={1000} cls="rad" marks={[100, 300, 500, 800]} showMax label={`Радіація ${c.rad} з 1000`} />
            {d.radStage > 0 && <div className="neg">{RAD_STAGE[d.radStage]} стадія: {RAD_FX[d.radStage]}.</div>}
          </div>
        </Box>
      )}
      {open === "luck" && <Box title="Удача" ro={ro || api.gm}><LuckControls {...api} ro={ro || api.gm} /></Box>}
      {open === "move" && (
        <Box title="Швидкість">
          <div className="pad">
            <KV k="Рух · додаткова дія"><span className="num">{move} м</span></KV>
            <KV k="Ривок · основна дія"><span className="num">{move * 2} м</span></KV>
            <KV k="Повзком, лазіння · додаткова"><span className="num">{crawl} м</span></KV>
            <div className="hint">Подорож: 5 км/год, бігом 12. Важкий терен, аномалії, ніч чи потай: удвічі довше.</div>
            {spr < num(c.attrs.spr) && <div className="neg">Спритність знижена: {num(c.attrs.spr)} → {spr}.</div>}
          </div>
        </Box>
      )}
    </div>
  );
}

/** Why an attribute is not its base value, for the tile's tooltip: "радіація −1, рани ÷2". */
function reasons(d: SheetApi["d"], k: AttrKey): string {
  return [...d.lines[k].map(([src, v]) => `${src} ${v > 0 ? "+" : "−"}${Math.abs(v)}`), ...d.halves[k].map(src => `${src} ÷2`)].join(", ");
}

function AttrsBox({ c, d, ro, gm, edit, up }: SheetApi) {
  return (
    <Box title="Характеристики" ro={ro || gm}>
      <div className="attrs">
        {ATTRS.map(a => {
          const base = num(c.attrs[a.key]), v = d.eff[a.key];
          return (
            <div className="attr" key={a.key} title={[a.name, reasons(d, a.key)].filter(Boolean).join(": ")}>
              <span className={cx("v", v < base && "neg", v > base && "pos")}>{v}</span>
              <span className="lbl">{a.name}</span>
              <span className="was" style={{ visibility: v !== base ? "visible" : "hidden" }}>з {base}</span>
            </div>
          );
        })}
      </div>
      {edit && (
        <div className="edlist">
          {ATTRS.map(a => {
            const k: AttrKey = a.key, mod = num(c.attrMod[k]);
            return (
              <div className="edrow" key={k}>
                <b>{a.name}</b>
                <Stepper value={num(c.attrs[k])} min={1} max={12} set={n => up(x => { x.attrs[k] = n; x.hp = Math.min(x.hp, maxHp(x)); })} />
                <span className="hint">інше</span>
                <Stepper value={mod} min={-9} max={9} show={mod > 0 ? "+" + mod : mod} set={n => up(x => { x.attrMod[k] = n; })} />
              </div>
            );
          })}
          <div className="edrow"><b>Вільні бали характеристик</b><Stepper value={c.freeAttr} min={0} max={99} set={n => up(x => { x.freeAttr = n; })} /></div>
          <div className="edrow"><b>Пул удачі</b><Stepper value={num(c.luck.pool)} min={0} max={99} set={n => up(x => { const was = num(x.luck.pool); setLuckPool(x, n); if (n > was) x.luck.cur = num(x.luck.cur) + (n - was); })} /></div>
        </div>
      )}
    </Box>
  );
}

function SkillRow({ name, lvl, edit, set }: { name: string; lvl: number; edit: boolean; set: (n: number) => void }) {
  return (
    <div className={cx("skrow", !lvl && "zero")}>
      <span className="nm">{name}</span>
      {edit ? <Stepper value={lvl} min={0} max={10} set={set} /> : <><Dots on={lvl} of={Math.max(5, lvl)} /><span className="lv">{lvl}</span></>}
    </div>
  );
}

function SkillsBox({ c, ro: ro0, gm, edit, up }: SheetApi) {
  const ro = ro0 || gm;
  const [all, setAll] = useState(false);
  const learned = SKILL_GROUPS.flatMap(g => g.skills).filter(s => num(c.skills[s.key]) > 0);
  const full = all || edit;
  const set = (k: (typeof SKILL_KEYS)[number]) => (n: number) => up(x => { x.skills[k] = n; });
  return (
    <Box title="Навички" ro={ro}>
      <div>
        {full ? SKILL_GROUPS.map(g => (
          <div key={g.name}>
            <div className="skgroup lbl">{g.name}</div>
            {g.skills.map(s => <SkillRow key={s.key} name={s.name} lvl={num(c.skills[s.key])} edit={edit} set={set(s.key)} />)}
          </div>
        )) : learned.length ? learned.map(s => <SkillRow key={s.key} name={s.name} lvl={num(c.skills[s.key])} edit={false} set={set(s.key)} />)
          : <p className="empty">Навичок ще немає.</p>}
        {edit && <div className="skrow"><span className="nm">Вільні бали навичок</span><Stepper value={c.freeSkill} min={0} max={99} set={n => up(x => { x.freeSkill = n; })} /></div>}
        <div className="skfoot">
          {!edit ? <Btn link onClick={() => setAll(!all)}>{all ? "Лише вивчені" : `Усі навички (${SKILL_KEYS.length})`}</Btn> : <span />}
          <span className="row hint">Знання Зони {edit ? <Stepper value={c.zone} min={0} max={10} set={n => up(x => { x.zone = n; })} /> : <span className="num" style={{ fontSize: 16, color: "var(--ink)" }}>{c.zone}</span>}</span>
        </div>
        {!edit && (c.freeSkill > 0 || c.freeAttr > 0) && (
          <div className="skfoot hint">Вільні бали: навичок {c.freeSkill}, характеристик {c.freeAttr}</div>
        )}
      </div>
    </Box>
  );
}

function AbilBox({ c, ro: ro0, gm, edit, up }: SheetApi) {
  const ro = ro0 || gm;
  if (!edit && c.abilities.length === 0) return null;
  const rr = c.reroll ?? { skill: "", bonus: 2 };
  return (
    <Box title="Здібності" ro={ro}>
      <div>
        {c.abilities.map((a, i) => (
          <div className="card" key={a.id}>
            {edit ? (
              <div className="fgrid">
                <Lab name="Назва" wide><Text value={a.name} set={v => up(x => { x.abilities[i].name = v; })} /></Lab>
                <Lab name="Що робить" wide><Area value={a.text} set={v => up(x => { x.abilities[i].text = v; })} /></Lab>
                <div className="wide"><Confirm sm={false} label="Видалити здібність" onConfirm={() => up(x => { x.abilities.splice(i, 1); })} /></div>
              </div>
            ) : <>
              <b style={{ fontSize: 16 }}>{a.name || "Без назви"}</b>
              {a.text && <span className="hint" style={{ fontSize: 14 }}>{a.text}</span>}
            </>}
          </div>
        ))}
        {edit && (
          <div className="addf">
            <div><Btn pri onClick={() => up(x => { x.abilities.push({ id: uid(), name: "", text: "" }); })}>Додати здібність</Btn></div>
            <div className="lbl">Перекид промаху в калькуляторі пострілу</div>
            <div className="row wrapg">
              <select className="in" aria-label="Для якої зброї" value={rr.skill} onChange={e => up(x => { x.reroll.skill = e.target.value as RerollSkill; })}>{REROLL_OPTIONS.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              <span className="row hint">бонус <Stepper value={num(rr.bonus)} min={0} max={9} show={"+" + num(rr.bonus)} set={n => up(x => { x.reroll.bonus = n; })} /></span>
            </div>
          </div>
        )}
      </div>
    </Box>
  );
}

function CondBox({ c, d, ro, edit, up }: SheetApi) {
  const cell = (name: string, value: number, max: number, set: (v: number) => void, warn = false, title?: string) => (
    <div className={cx("cond", value > 0 && "on", warn && "warn")} title={title}>
      <span className="lbl">{name}</span>
      <Stepper value={value} min={0} max={max} set={set} />
    </div>
  );
  return (
    <Box title="Стани" ro={ro}>
      <div className="conds">
        {cell("Алкоголь", c.vodka, 9, v => up(x => { x.vodka = v; }), c.vodka > 0 && !d.vodkaOut && d.nextVodkaOut, d.nextVodkaOut ? (c.vodka > 0 ? "Ще одна порція — непритомність" : "Перша ж порція — непритомність") : undefined)}
        {cell("Без сну", c.noSleep, 3, v => up(x => { x.noSleep = v; }))}
        {cell("Без їжі", c.noFood, 9, v => up(x => { x.noFood = v; }))}
        {cell("Без води", c.noWater, 9, v => up(x => { x.noWater = v; }))}
      </div>
      {(edit || c.conditions) && (
        <div className="pad">
          {edit ? <Text value={c.conditions} set={v => up(x => { x.conditions = v; })} label="Травми й ускладнення" placeholder="Травми й ускладнення" /> : <span>{c.conditions}</span>}
        </div>
      )}
    </Box>
  );
}
