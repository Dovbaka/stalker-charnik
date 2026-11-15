// The shot calculator: what the die has to show, worked out from the weapon and the situation.
// The dice are rolled at the table; this box only adds up the modifiers. Used on a sheet's «Бій» and for a foe
// in the GM's encounter.
import type { ReactNode } from "react";
import { SKILL_NAME } from "../rules/data";
import { FIRE_MODES, SHOT0, hasMod, rangedWeapons, resolveShot, shotCalc, weaponModes, type ShotOpts, type Shooter } from "../rules/character";
import { num, sign } from "../util";
import { Box, Btn, KV, Stepper, Tg, usePersisted } from "./bits";

function Group({ name, children }: { name: string; children: ReactNode }) {
  return <div className="cgroup"><div className="lbl">{name}</div>{children}</div>;
}

const needText = (n: number) => (n <= 1 ? "1+" : n > 10 ? "—" : n + "+");
const pc = (v: number) => Math.round(v * 100) + "%";

/**
 * `storeKey` keeps the chosen options in this browser. `mask` is the shooter's gas mask switch; a foe has none.
 * `title` names the box.
 */
export function ShotPanel({ who, checkPen, storeKey, mask, title = "Постріл" }: {
  who: Shooter; checkPen: number; storeKey: string; title?: string;
  mask?: { on: boolean; set: (v: boolean) => void; disabled?: boolean };
}) {
  const [saved, setO] = usePersisted<ShotOpts>(storeKey, SHOT0);
  const o = resolveShot(who, saved);
  const set = (patch: Partial<ShotOpts>) => setO({ ...saved, ...patch });
  const m = shotCalc(who, { checkPen }, o);
  const guns = rangedWeapons(who);
  const gun = guns.find(g => g.id === o.weapon);
  const modes = gun ? weaponModes(gun.modes) : FIRE_MODES.map(f => f.key);
  const canOptic = !gun || hasMod(gun, "optic"), canColim = !gun || hasMod(gun, "colim");
  // attachments the shooter switches on: a laser outside automatic fire, and anything with a bonus from the GM
  const extras = gun ? gun.mods.filter(md => num(md.bonus) !== 0 && (md.kind === "other" || (md.kind === "laser" && o.mode !== "auto"))) : [];
  const toggleMod = (id: string) => set({ mods: o.mods.includes(id) ? o.mods.filter(x => x !== id) : [...o.mods, id] });
  const flag = (key: "sit" | "optic" | "colim" | "nato" | "lying" | "tprone" | "vis" | "invis", text: string, mod: string, disabled = false) =>
    <Tg on={o[key] && !disabled} mod={mod} disabled={disabled} onClick={() => set({ [key]: !saved[key] } as Partial<ShotOpts>)}>{text}</Tg>;
  const skills = (["rifles", "pistols", "heavy"] as const).map(k => <Tg key={k} on={o.skill === k} mod={String(num(who.skills[k]))} onClick={() => set({ skill: k })}>{SKILL_NAME[k]}</Tg>);

  return (
    <Box title={title} right={<Btn sm onClick={() => setO({ ...SHOT0, weapon: saved.weapon })}>Скинути</Btn>}>
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
              ? guns.map(g => <Tg key={g.id} on={o.weapon === g.id} mod={String(num(who.skills[g.skill]))} onClick={() => set({ weapon: o.weapon === g.id ? "" : g.id })}>{g.name}</Tg>)
              : skills}
          </div>
          {guns.length > 0 && !gun && <div className="seg">{skills}</div>}
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
            {canOptic && flag("optic", "Оптика, від 50 м", "+1")}{canColim && flag("colim", "Коліматор, до 50 м", "+1")}
            {extras.map(md => <Tg key={md.id} on={o.mods.includes(md.id)} mod={sign(num(md.bonus)).replace(" ", "")} onClick={() => toggleMod(md.id)}>{md.name}</Tg>)}
            {flag("lying", "Стрільба лежачи", gun && hasMod(gun, "bipod") ? "сошки" : "−2")}{flag("vis", "Туман, дощ", "−2")}
            {mask && <Tg on={mask.on} mod="−1" disabled={mask.disabled} onClick={() => mask.set(!mask.on)}>Протигаз</Tg>}
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
