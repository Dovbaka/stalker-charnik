import { MOD_INFO } from "../../rules/data";
import { artifactStates, artifactTotals, protection, quickDraw, radTurnText, reload, worn } from "../../rules/character";
import { clamp, cx, num } from "../../util";
import { Box, Btn, Check, KV, Stepper, toast } from "../bits";
import { ShotPanel } from "../ShotPanel";
import type { SheetApi } from "../Sheet";
import { HealthBox, LuckControls } from "./parts";

export function CombatTab(api: SheetApi) {
  return <>
    <div className="col">
      <HealthBox {...api} combat />
      {num(api.c.luck.pool) > 0 && <Box title="Удача" ro={api.ro || api.gm}><LuckControls {...api} ro={api.ro || api.gm} /></Box>}
    </div>
    <div className="col"><ShotBox {...api} /></div>
    <div className="col"><GunsBox {...api} /><ArmorBox {...api} /></div>
  </>;
}

/** The shot calculator on this sheet; works on anyone's sheet, the gas mask only on one the viewer may change. */
function ShotBox({ c, d, ro, up }: SheetApi) {
  return <ShotPanel who={c} checkPen={d.checkPen} storeKey="charnik.shot" mask={{ on: c.mask, disabled: ro, set: v => up(x => { x.mask = v; }) }} />;
}

/** Weapons on the body: ammunition, reloading, jams. They are added, edited and put on in «Рюкзак». */
function GunsBox({ c, d, ro, up }: SheetApi) {
  const guns = c.weapons.map((g, i) => ({ g, i })).filter(x => x.g.on);
  return (
    <Box title="Зброя на собі" ro={ro}>
      <div>
        {guns.length === 0 && <p className="empty">Зброї на собі немає.</p>}
        {guns.map(({ g, i }) => {
          const mag = num(g.mag), cur = clamp(num(g.cur), 0, mag), jams = num(g.jams);
          const meta = [g.range, g.dmg, g.cal, g.nato ? "НАТО +1" : ""].filter(Boolean).join(" · ");
          const draw = g.skill === "melee" || g.skill === "unarmed" ? null : Math.round(quickDraw(c, d, g) * 100);
          return (
            <div className="card" key={g.id}>
              <div className="row base wrapg" style={{ minWidth: 0 }}><h3>{g.name}</h3>{meta && <span className="hint num">{meta}</span>}</div>
              {g.mods.length > 0 && <div className="chips">{g.mods.map(md => <span key={md.id} className="chip" title={MOD_INFO[md.kind]?.info || undefined}>{md.name}</span>)}</div>}
              {draw != null && <div className="hint num">Швидко вихопити: {draw}%</div>}
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
            </div>
          );
        })}
      </div>
    </Box>
  );
}

/** The armour being worn and the gas mask. Other armour waits in «Рюкзак». */
function ArmorBox({ c, ro, up }: SheetApi) {
  const a = worn(c), p = protection(c), art = artifactTotals(c);
  const withArt = Object.values(artifactStates(c)).includes("on");
  const tiles: [string, number][] = a ? [["Кінет", p.kin], ["Кисл", p.acid], ["Вогонь", p.fire], ["Елект", p.elec], ["Рад", p.rad + (c.mask ? 5 : 0)]] : [];
  return (
    <Box title="Броня" ro={ro}>
      <div className="pad">
        {a ? <><b>{a.name}{withArt && <span className="hint"> · з артефактами</span>}</b><div className="prot">{tiles.map(t => <div key={t[0]}><b className={cx(t[1] < 0 && "neg")}>{t[1] < 0 ? "−" + -t[1] : num(t[1])}</b><span>{t[0]}</span></div>)}</div></>
          : <span className="hint">Броню не надіто.</span>}
        {art.radTurn !== 0 && <div className={art.radTurn > 0 ? "amber" : "hint"}>{radTurnText(art.radTurn)}</div>}
        <Check checked={c.mask} set={v => up(x => { x.mask = v; })}>Протигаз: +5 від радіації, −1 до влучання</Check>
      </div>
    </Box>
  );
}
