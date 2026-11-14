import { useState, type ReactNode } from "react";
import { GUNS, SKILL_NAME, WEAPON_SKILLS } from "../../rules/data";
import { FIRE_MODES, SHOT0, addGun, rangedWeapons, reload, resolveShot, shotCalc, weaponModes, type ShotOpts } from "../../rules/character";
import type { SkillKey } from "../../rules/types";
import { clamp, cx, num, sign } from "../../util";
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

function Group({ name, children }: { name: string; children: ReactNode }) {
  return <div className="cgroup"><div className="lbl">{name}</div>{children}</div>;
}

const needText = (n: number) => (n <= 1 ? "1+" : n > 10 ? "—" : n + "+");
const pc = (v: number) => Math.round(v * 100) + "%";

/**
 * What the die has to show, worked out from the weapon and the situation. The dice are rolled at the table:
 * this box only adds up the modifiers. Works on anyone's sheet.
 */
function ShotBox({ c, d, ro, up }: SheetApi) {
  const [saved, setO] = usePersisted<ShotOpts>("charnik.shot", SHOT0);
  const o = resolveShot(c, saved);
  const set = (patch: Partial<ShotOpts>) => setO({ ...saved, ...patch });
  const m = shotCalc(c, d, o);
  const guns = rangedWeapons(c);
  const gun = guns.find(g => g.id === o.weapon);
  const modes = gun ? weaponModes(gun.modes) : FIRE_MODES.map(f => f.key);
  const flag = (key: "sit" | "optic" | "colim" | "nato" | "lying" | "tprone" | "vis" | "invis", text: string, mod: string, disabled = false) =>
    <Tg on={o[key] && !disabled} mod={mod} disabled={disabled} onClick={() => set({ [key]: !saved[key] } as Partial<ShotOpts>)}>{text}</Tg>;

  return (
    <Box title="Постріл" right={<Btn sm onClick={() => setO({ ...SHOT0, weapon: saved.weapon })}>Скинути</Btn>}>
      <div className="pad">
        <div className="calcres" aria-live="polite">
          {m.shots.map((s, i) => (
            <div className="shot" key={i}>
              {m.shots.length > 1 && <span className="k">{i + 1}-й</span>}
              <span className="n">{needText(s.need)}</span>
              <span className="p">{s.need > 10 ? "не влучити" : pc(s.chance)}</span>
            </div>
          ))}
        </div>
        {m.reroll && m.need > 1 && m.need <= 10 && <div className="hint">З перекидом +{m.rerollBonus}: {pc(m.chanceReroll)}</div>}

        <Group name="Зброя">
          <div className="seg">
            {guns.length > 0
              ? guns.map(g => <Tg key={g.id} on={o.weapon === g.id} mod={String(num(c.skills[g.skill]))} onClick={() => set({ weapon: o.weapon === g.id ? "" : g.id })}>{g.name}</Tg>)
              : (["rifles", "pistols", "heavy"] as const).map(k => <Tg key={k} on={o.skill === k} mod={String(num(c.skills[k]))} onClick={() => set({ skill: k })}>{SKILL_NAME[k]}</Tg>)}
          </div>
          {guns.length > 0 && !gun && (
            <div className="seg">{(["rifles", "pistols", "heavy"] as const).map(k => <Tg key={k} on={o.skill === k} mod={String(num(c.skills[k]))} onClick={() => set({ skill: k })}>{SKILL_NAME[k]}</Tg>)}</div>
          )}
        </Group>

        <Group name="Постріл">
          <div className="seg">
            <Tg on={o.shot === "aimed"} onClick={() => set({ shot: "aimed" })}>Прицільний</Tg>
            <Tg on={o.shot === "quick"} mod="−1" onClick={() => set({ shot: "quick" })}>Швидкий</Tg>
            {flag("sit", "Сидячи", "+1", o.shot !== "aimed")}
          </div>
          <div className="seg">
            {FIRE_MODES.map(f => <Tg key={f.key} on={o.mode === f.key} disabled={!modes.includes(f.key)} mod={f.pens.length > 1 ? String(f.pens.length) : undefined} onClick={() => set({ mode: f.key })}>{f.name}</Tg>)}
          </div>
        </Group>

        <Group name="Ціль">
          <div className="seg">
            <Tg on={o.near === "far"} onClick={() => set({ near: "far" })}>Далі 10 м</Tg>
            <Tg on={o.near === "10"} mod="+1" onClick={() => set({ near: "10" })}>До 10 м</Tg>
            <Tg on={o.near === "1"} mod="+3" onClick={() => set({ near: "1" })}>До 1 м</Tg>
          </div>
          <div className="seg">
            <Tg on={o.cover === "0"} onClick={() => set({ cover: "0" })}>Відкрита</Tg>
            <Tg on={o.cover === "1"} mod="−1" onClick={() => set({ cover: "1" })}>Укриття ½</Tg>
            <Tg on={o.cover === "3"} mod="−3" onClick={() => set({ cover: "3" })}>Укриття ¾</Tg>
          </div>
          <div className="seg">{flag("tprone", "Лежить", "−1")}{flag("invis", "Невидима", "−3")}</div>
        </Group>

        <Group name="Умови">
          <div className="seg">
            {flag("optic", "Оптика, від 50 м", "+1")}{flag("colim", "Коліматор, до 50 м", "+1")}
            {flag("lying", "Стріляю лежачи", "−2")}{flag("vis", "Туман, дощ", "−2")}
            <Tg on={c.armor.mask} mod="−1" disabled={ro} onClick={() => up(x => { x.armor.mask = !x.armor.mask; })}>Протигаз</Tg>
            {!gun && flag("nato", "Зброя НАТО", "+1")}
          </div>
          <KV k="Раунди по цій цілі"><Stepper value={o.rounds} min={0} max={9} show={o.rounds > 0 ? "+" + o.rounds : 0} set={v => set({ rounds: v })} /></KV>
          {!gun && <KV k="Зброя клинила"><Stepper value={o.jam} min={0} max={2} show={o.jam > 0 ? "−" + o.jam : 0} set={v => set({ jam: v })} /></KV>}
          <KV k="Інше"><Stepper value={o.extra} min={-9} max={9} show={o.extra > 0 ? "+" + o.extra : o.extra} set={v => set({ extra: v })} /></KV>
        </Group>

        <div className="formula">к10 {m.parts.map(x => `${sign(x[1])} ${x[0]}`).join(" ")}, влучає на 9+</div>
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
                <KV k={<span className={cx(jams > 0 ? "neg" : "hint")}>{jams >= 3 ? "Клинила: непридатна" : jams > 0 ? `Клинила: −${jams}` : "Клинила"}</span>}>
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
                  <Lab name="Режими вогню"><Text value={g.modes} placeholder="напівавтомат, автомат, по 3" set={v => up(x => { x.weapons[i].modes = v; })} /></Lab>
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
