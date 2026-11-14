import { useState } from "react";
import { forViewer, gunGroups, itemGroups } from "../../rules/catalog";
import { ART_FX_INFO, ART_RARITY, ART_TYPES, MOD_CHOICES, MOD_INFO, SKILL_NAME, WEAPON_SKILLS, marketName, modPreset } from "../../rules/data";
import { MAX_SLOTS, addArmor, addArtifact, addGun, addMarketItem, artifactStates, artifactTotals, newArmor, newMod, slotsOf, useCharge, useItem, wear, weightParts, worn } from "../../rules/character";
import type { ArtFx, Artifact, SkillKey } from "../../rules/types";
import { useCampaign } from "../../state/context";
import { cx, fmt, kg, num, uid } from "../../util";
import { Box, Btn, Check, Confirm, Lab, Meter, NumIn, Stepper, Text, toast } from "../bits";
import type { SheetApi } from "../Sheet";

/** The GM's catalogue as this person may take from it: players see what the GM has not hidden. */
function useCatalog() {
  const [st] = useCampaign();
  return forViewer(st.catalog, st.gm);
}
const NOT_IN_CATALOG = "Цього вже немає в каталозі.";
const hiddenMark = (hidden?: boolean) => (hidden ? " · приховано" : "");

/** Everything the character owns: coupons, the load, weapons, armour, items, artefacts. */
export function PackTab(api: SheetApi) {
  return <>
    <div className="col"><MoneyBox {...api} /></div>
    <div className="col"><WeaponsBox {...api} /><ArmorsBox {...api} /><ArtifactsBox {...api} /></div>
    <div className="col"><ItemsBox {...api} /></div>
  </>;
}

/** Coupons and the load share a box: both answer "can I take this". */
function MoneyBox({ c, d, ro, up }: SheetApi) {
  const [amt, setAmt] = useState("");
  const move = (dir: 1 | -1) => {
    const n = Math.round(num(amt, NaN));
    if (!(n > 0)) { toast("Немає суми."); return; }
    if (dir < 0 && n > c.money) { toast("Стільки купонів немає."); return; }
    const undo = up(x => { x.money += n * dir; });
    toast(`${dir > 0 ? "+" : "−"}${fmt(n)} куп.`, undo);
    setAmt("");
  };
  const limit = d.cap * 1.5;
  const parts = weightParts(c);
  const made = ([["зброя", parts.weapons], ["броня", parts.armor], ["речі", parts.items]] as [string, number][]).filter(([, w]) => w > 0).map(([n, w]) => `${n} ${kg(w)}`).join(" · ");
  return (
    <div className="stack">
      <Box title="Купони" ro={ro}>
        <div className="pad">
          <div className="big">{fmt(c.money)}</div>
          <div className="row wrapg">
            <input className="in w6 num" inputMode="numeric" placeholder="сума" aria-label="Сума" value={amt} onChange={e => setAmt(e.target.value)} />
            <Btn pri onClick={() => move(1)}>+ Дохід</Btn><Btn onClick={() => move(-1)}>− Витрата</Btn>
          </div>
        </div>
      </Box>
      <Box title="Вантаж" ro={ro} right={<span className={d.over === 2 ? "neg" : "amber"} style={{ visibility: d.over ? "visible" : "hidden" }}>{d.over === 2 ? "Понад межу" : "Спритність ÷2"}</span>}>
        <div className="pad">
          <div className="row between base wrapg"><span className="big">{kg(d.weight)}<small> / {d.cap} кг</small></span><span className="hint num">{made || "нічого"}</span></div>
          <Meter value={d.weight} max={limit} cls={cx("load", d.over === 1 && "over", d.over === 2 && "limit")} marks={[d.cap]} label={`Вантаж ${kg(d.weight)} кг: без штрафу до ${d.cap}, межа ${kg(limit)}`} />
        </div>
      </Box>
    </div>
  );
}

/** Every weapon owned. "На собі" marks the ones carried ready; those appear in «Бій». */
function WeaponsBox({ c, ro, edit, up }: SheetApi) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState("");
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  const cat = useCatalog();
  const add = () => {
    const g = pick === "" ? undefined : cat.guns.find(x => x.id === pick);
    if (pick !== "" && !g) { toast(NOT_IN_CATALOG); return; }
    if (g && buy && g.p && c.money < g.p) { toast(`Не вистачає купонів: треба ${g.p}.`); return; }
    const id = uid();
    const undo = up(x => { if (g && buy) x.money -= g.p; addGun(x, g, id); });
    toast(!g ? "Додано: своя зброя." : buy && g.p ? `Куплено: ${g.n}, −${g.p} куп.` : `Додано: ${g.n}.`, undo);
    if (!g) setOpen(id); // an own weapon starts blank, so its fields open at once
    setAdding(false);
  };
  return (
    <Box title="Зброя" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.weapons.length === 0 && !adding && <p className="empty">Зброї немає.</p>}
        {c.weapons.map((g, i) => {
          const meta = [g.range, g.dmg, g.cal, g.mag ? `магазин ${g.mag}` : "", g.nato ? "НАТО" : ""].filter(Boolean).join(" · ");
          const isOpen = open === g.id;
          return (
            <div className="card" key={g.id}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div className="nm" style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <b style={{ overflowWrap: "anywhere" }}>{g.name}</b>
                  <span className="hint num">{meta || SKILL_NAME[g.skill]}</span>
                </div>
                <span className="iw num">{kg(num(g.w))} кг</span>
              </div>
              {g.mods.length > 0 && !isOpen && <div className="chips">{g.mods.map(md => <span key={md.id} className="chip">{md.name}</span>)}</div>}
              <div className="row between">
                <Check checked={g.on} set={v => up(x => { x.weapons[i].on = v; })}>На собі</Check>
                {!ro && <Btn sm pri={isOpen} onClick={() => setOpen(isOpen ? "" : g.id)}>{isOpen ? "Готово" : "Змінити"}</Btn>}
              </div>
              {(edit || isOpen) && <WeaponEdit {...{ c, up, i }} />}
              {isOpen && <ModsEditor {...{ c, up, i }} />}
              {(edit || isOpen) && <div><Confirm sm={false} label="Викинути зброю" ask="Точно викинути?" title="Викинути зброю" onConfirm={() => toast(`Викинуто: ${g.name}.`, up(x => { x.weapons.splice(i, 1); }))} /></div>}
            </div>
          );
        })}
        {adding && (
          <div className="addf">
            <div className="row wrapg">
              <select className="in" aria-label="Яку зброю додати" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">Своя зброя</option>
                {gunGroups(cat.guns).map(grp => {
                  const xs = cat.guns.filter(g => g.g === grp);
                  return xs.length ? <optgroup key={grp} label={grp}>{xs.map(g => <option key={g.id} value={g.id}>{g.n}{g.p ? `, ${g.p} куп.` : ""}{hiddenMark(g.hidden)}</option>)}</optgroup> : null;
                })}
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

/** A weapon's own numbers, under its «Змінити» button or in «Редагувати». */
function WeaponEdit({ c, up, i }: Pick<SheetApi, "c" | "up"> & { i: number }) {
  const g = c.weapons[i];
  return (
    <div className="fgrid">
      <Lab name="Назва" wide><Text value={g.name} set={v => up(x => { x.weapons[i].name = v; })} /></Lab>
      <Lab name="Навичка"><select className="in" value={g.skill} onChange={e => up(x => { x.weapons[i].skill = e.target.value as SkillKey; })}>{WEAPON_SKILLS.map(k => <option key={k} value={k}>{SKILL_NAME[k]}</option>)}</select></Lab>
      <Lab name="Шкода"><Text value={g.dmg} placeholder="2к10" set={v => up(x => { x.weapons[i].dmg = v; })} /></Lab>
      <Lab name="Магазин"><NumIn value={num(g.mag)} set={v => up(x => { x.weapons[i].mag = v; x.weapons[i].cur = Math.min(x.weapons[i].cur, v); })} /></Lab>
      <Lab name="Вага, кг"><NumIn value={num(g.w)} set={v => up(x => { x.weapons[i].w = v; })} /></Lab>
      <Lab name="Калібр"><Text value={g.cal} set={v => up(x => { x.weapons[i].cal = v; })} /></Lab>
      <Lab name="Режими вогню"><Text value={g.modes} placeholder="напівавтомат, автомат, по 3" set={v => up(x => { x.weapons[i].modes = v; })} /></Lab>
      <Lab name="Нотатка" wide><Text value={g.note} set={v => up(x => { x.weapons[i].note = v; })} /></Lab>
      <Check wide checked={g.nato} set={v => up(x => { x.weapons[i].nato = v; })}>Зброя НАТО, +1 до влучання</Check>
    </div>
  );
}

/** Attachments of one weapon: add from the list or your own, set the GM's bonus, take off. */
function ModsEditor({ c, up, i }: Pick<SheetApi, "c" | "up"> & { i: number }) {
  const g = c.weapons[i];
  const [kind, setKind] = useState<(typeof MOD_CHOICES)[number]>("optic");
  const addMod = () => up(x => { x.weapons[i].mods.push(newMod(kind === "other" ? { name: "Модифікація", kind, bonus: 0 } : modPreset(kind))); });
  return <div className="modsed">
    {g.mods.length === 0 && <span className="hint">Модифікацій немає.</span>}
    {g.mods.map((md, j) => (
      <div className="edrow" key={md.id} style={{ paddingTop: 0 }}>
        {md.kind === "other" ? <Text value={md.name} label="Назва модифікації" set={v => up(x => { x.weapons[i].mods[j].name = v; })} className="grow" /> : <b>{md.name}</b>}
        {md.kind === "other"
          ? <span className="row hint">бонус <Stepper value={num(md.bonus)} min={-5} max={5} show={num(md.bonus) > 0 ? "+" + md.bonus : md.bonus} set={v => up(x => { x.weapons[i].mods[j].bonus = v; })} /></span>
          : <span className="hint">{MOD_INFO[md.kind]?.info}</span>}
        <Confirm title="Зняти модифікацію" onConfirm={() => up(x => { x.weapons[i].mods.splice(j, 1); })} />
      </div>
    ))}
    <div className="row wrapg">
      <select className="in" aria-label="Яку модифікацію додати" value={kind} onChange={e => setKind(e.target.value as (typeof MOD_CHOICES)[number])}>
        {MOD_CHOICES.map(k => <option key={k} value={k}>{MOD_INFO[k].name}</option>)}
      </select>
      <Btn onClick={addMod}>Додати</Btn>
    </div>
  </div>;
}

/** Every armour owned. Only one can be worn; its numbers protect in «Бій». */
function ArmorsBox({ c, ro, edit, up }: SheetApi) {
  const [open, setOpen] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  const cat = useCatalog();
  const field = (i: number, name: string, key: "kin" | "acid" | "fire" | "elec" | "rad" | "w" | "slots") =>
    <Lab name={name}><NumIn value={num(c.armors[i][key])} set={v => up(x => { x.armors[i][key] = key === "slots" ? Math.min(MAX_SLOTS, Math.round(v)) : v; })} /></Lab>;
  // an own armour starts blank, so its fields open at once
  const addOwn = () => { const a = newArmor(); toast("Додано: своя броня.", up(x => { x.armors.push({ ...a }); })); setOpen(a.id); setAdding(false); };
  const add = () => {
    if (pick === "") { addOwn(); return; }
    const a = cat.armors.find(x => x.id === pick);
    if (!a) { toast(NOT_IN_CATALOG); return; }
    if (buy && a.p && c.money < a.p) { toast(`Не вистачає купонів: треба ${a.p}.`); return; }
    const undo = up(x => { if (buy) x.money -= a.p; addArmor(x, a); });
    toast(buy && a.p ? `Куплено: ${a.n}, −${a.p} куп.` : `Додано: ${a.n}.`, undo);
    setAdding(false);
  };
  // with no armour in the catalogue there is nothing to choose from: «+ Додати» makes a blank one at once
  const plus = () => (cat.armors.length ? setAdding(true) : addOwn());
  return (
    <Box title="Броня" ro={ro} right={!ro && !adding ? <Btn sm onClick={plus}>+ Додати</Btn> : undefined}>
      <div>
        {c.armors.length === 0 && !adding && <p className="empty">Броні немає.</p>}
        {c.armors.map((a, i) => {
          const isOpen = open === a.id;
          return (
          <div className="card" key={a.id}>
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{a.name}</b>
                <span className="hint num">кін {num(a.kin)} · кисл {num(a.acid)} · вог {num(a.fire)} · ел {num(a.elec)} · рад {num(a.rad)}</span>
                {a.note && <span className="hint">{a.note}</span>}
              </div>
              <span className="iw num">{a.countW ? kg(num(a.w)) + " кг" : "—"}</span>
            </div>
            <div className="row between">
              <Check checked={a.on} set={() => up(x => wear(x, a.id))}>Надіта</Check>
              {!ro && !edit && <Btn sm pri={isOpen} onClick={() => setOpen(isOpen ? "" : a.id)}>{isOpen ? "Готово" : "Змінити"}</Btn>}
            </div>
            {(edit || isOpen) && <>
              <div className="fgrid">
                <Lab name="Назва" wide><Text value={a.name} set={v => up(x => { x.armors[i].name = v; })} /></Lab>
                {field(i, "Кінетика", "kin")}{field(i, "Кислота", "acid")}{field(i, "Вогонь", "fire")}{field(i, "Електрика", "elec")}{field(i, "Радіація", "rad")}{field(i, "Вага, кг", "w")}{field(i, "Контейнери", "slots")}
                <Lab name="Примітка" wide><Text value={a.note ?? ""} set={v => up(x => { if (v) x.armors[i].note = v; else delete x.armors[i].note; })} /></Lab>
                <Check wide checked={a.countW} set={v => up(x => { x.armors[i].countW = v; })}>Рахувати вагу у вантаж</Check>
              </div>
              <div><Confirm sm={false} label="Викинути броню" ask="Точно викинути?" title="Викинути броню" onConfirm={() => toast(`Викинуто: ${a.name}.`, up(x => { x.armors.splice(i, 1); }))} /></div>
            </>}
          </div>
          );
        })}
        {adding && (
          <div className="addf">
            <div className="row wrapg">
              <select className="in" aria-label="Яку броню додати" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">Своя броня</option>
                {cat.armors.map(a => <option key={a.id} value={a.id}>{a.n}{a.p ? `, ${a.p} куп.` : ""}{hiddenMark(a.hidden)}</option>)}
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

function ItemsBox({ c, ro, edit, up }: SheetApi) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState("");
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [weight, setWeight] = useState("");
  const cat = useCatalog();
  const picked = cat.items.find(x => x.id === pick) ?? cat.items[0];
  const addFromMarket = () => {
    const m = picked;
    if (!m) { toast(NOT_IN_CATALOG); return; }
    if (buy && c.money < m.p) { toast(`Не вистачає купонів: треба ${m.p}.`); return; }
    const undo = up(x => { if (buy) x.money -= m.p; addMarketItem(x, m); });
    toast(buy ? `Куплено: ${marketName(m)}, −${m.p} куп.` : `Додано: ${marketName(m)}.`, undo);
  };
  const addOwn = () => {
    const n = name.trim();
    if (!n) { toast("Немає назви."); return; }
    const undo = up(x => { x.items.push({ id: uid(), name: n, qty: Math.max(1, Math.round(num(qty, 1))), w: Math.max(0, num(weight, 0)), note: "" }); });
    toast(`Додано: ${n}.`, undo);
    setName(""); setQty(""); setWeight("");
  };
  return (
    <Box title="Речі" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.items.length === 0 && !adding && <p className="empty">Речей немає.</p>}
        {c.items.map((it, i) => {
          const q = num(it.qty), isOpen = open === it.id;
          return (
            <div className={cx("irow", !q && "zero")} key={it.id}>
              <div className="nm">
                <b>{it.name}</b>
                {it.uses != null && <span className="hint">у початому: {q > 0 ? num(it.uses) : 0}</span>}
              </div>
              {it.fx && <Btn sm pri disabled={q <= 0} onClick={() => { let msg = ""; const undo = up(x => { msg = useItem(x, it.id); }); if (msg) toast(msg, undo); }}>Вжити</Btn>}
              {it.uses != null && !it.fx && <Btn sm disabled={q <= 0} onClick={() => toast(`${it.name}: одне використання.`, up(x => useCharge(x.items[i])))}>Використати</Btn>}
              <Stepper value={q} min={0} max={9999} set={v => up(x => { x.items[i].qty = v; })} />
              {/* weight and «Змінити» keep to the right edge, also when they wrap to a line of their own */}
              <span className="iend">
                <span className="iw num">{kg(q * num(it.w))} кг</span>
                {!ro && !edit && <Btn sm pri={isOpen} onClick={() => setOpen(isOpen ? "" : it.id)}>{isOpen ? "Готово" : "Змінити"}</Btn>}
              </span>
              {(edit || isOpen) && (
                <div className="fgrid" style={{ flex: "1 1 100%" }}>
                  <Lab name="Назва"><Text value={it.name} set={v => up(x => { x.items[i].name = v; })} /></Lab>
                  <Lab name="Вага однієї, кг"><NumIn value={num(it.w)} set={v => up(x => { x.items[i].w = v; })} /></Lab>
                  <Lab name="Нотатка" wide><Text value={it.note} set={v => up(x => { x.items[i].note = v; })} /></Lab>
                  <div className="wide"><Confirm sm={false} label="Викинути" ask="Точно викинути?" title="Викинути річ" onConfirm={() => toast(`Викинуто: ${it.name}.`, up(x => { x.items.splice(i, 1); }))} /></div>
                </div>
              )}
            </div>
          );
        })}
        {adding && <>
          {cat.items.length > 0 && <div className="addf">
            <div className="lbl">З каталогу майстра</div>
            <div className="row wrapg">
              <select className="in" aria-label="Що додати" value={picked?.id ?? ""} onChange={e => setPick(e.target.value)}>
                {itemGroups(cat.items).map(grp => (
                  <optgroup key={grp} label={grp}>
                    {cat.items.filter(m => m.g === grp).map(m => <option key={m.id} value={m.id}>{marketName(m)}{m.p ? `, ${m.p} куп.` : ""}{hiddenMark(m.hidden)}</option>)}
                  </optgroup>
                ))}
              </select>
              <Btn pri onClick={addFromMarket}>Додати</Btn>
            </div>
            <Check checked={buy} set={setBuy}>Купити: списати купони</Check>
          </div>}
          <div className="addf">
            <div className="lbl">Своя річ</div>
            <div className="row wrapg">
              <input className="in" style={{ flex: "1 1 9em" }} placeholder="Назва" aria-label="Назва речі" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addOwn(); }} />
              <input className="in w4 num" inputMode="numeric" placeholder="шт" aria-label="Кількість" value={qty} onChange={e => setQty(e.target.value)} />
              <input className="in w4 num" inputMode="decimal" placeholder="кг" aria-label="Вага однієї, кг" value={weight} onChange={e => setWeight(e.target.value)} />
              <Btn pri onClick={addOwn}>Додати</Btn>
            </div>
            <div><Btn onClick={() => setAdding(false)}>Готово</Btn></div>
          </div>
        </>}
      </div>
    </Box>
  );
}

const TYPE_NAME = Object.fromEntries(ART_TYPES) as Record<string, string>;
const RARITY_NAME = Object.fromEntries(ART_RARITY) as Record<string, string>;
const signed = (v: number) => (v > 0 ? "+" : "−") + Math.abs(v);
/** Artefact effects as short chips: "+1 Спритність", "−4 захист від електрики", "+5 рад за хід". Green helps, red hurts. */
export function FxChips({ fx }: { fx: ArtFx }) {
  const xs = ART_FX_INFO.filter(f => num(fx[f.key]) !== 0);
  if (!xs.length) return null;
  return <div className="chips">{xs.map(f => { const v = num(fx[f.key]); return <span key={f.key} className={cx("chip", v * f.good > 0 ? "good" : "bad")}>{signed(v)} {f.short}</span>; })}</div>;
}

/**
 * Artefacts come from the GM's catalogue. Ticking «У контейнері» puts one into a container of the worn armour; the rules then count
 * its numbers into attributes and protection. A player sees an artefact's properties only once the GM has made them known.
 */
function ArtifactsBox({ c, ro, edit, up }: SheetApi) {
  const [st] = useCampaign();
  const cat = useCatalog();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState("");
  const [pick, setPick] = useState("");
  const [buy, setBuy] = useState(false);
  if (ro && c.artifacts.length === 0) return null;
  const states = artifactStates(c), cap = slotsOf(c), armour = worn(c);
  const used = Object.values(states).filter(x => x === "on" || x === "same").length;
  // the GM sees everything; a player sees what the GM revealed on this sheet or made public in the catalogue
  const known = (a: Artifact) => st.gm || !a.secret || st.catalog.artifacts.find(x => x.id === a.catId)?.secret === false;
  const working = c.artifacts.filter(a => states[a.id] === "on");
  const sum = artifactTotals(c, known), unknownOn = working.some(a => !known(a));
  const picked = cat.artifacts.find(x => x.id === pick) ?? cat.artifacts[0];
  const add = () => {
    const e = picked;
    if (!e) { toast(NOT_IN_CATALOG); return; }
    if (buy && e.p && c.money < e.p) { toast(`Не вистачає купонів: треба ${e.p}.`); return; }
    const undo = up(x => { if (buy && e.p) x.money -= e.p; addArtifact(x, e); });
    toast(buy && e.p ? `Куплено: ${e.n}, −${e.p} куп.` : `Додано: ${e.n}.`, undo);
    setAdding(false);
  };
  return (
    <Box title="Артефакти" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        <div className="pad hint">
          {!armour ? "Броню не надіто: артефакти нікуди вкласти." : cap ? `Контейнери: ${used} з ${cap} · ${armour.name}` : `У броні «${armour.name}» контейнерів немає.`}
        </div>
        {c.artifacts.length === 0 && !adding && <p className="empty">Артефактів немає.</p>}
        {c.artifacts.map((a, i) => {
          const isOpen = open === a.id, k = known(a), stt = states[a.id];
          return (
            <div className="card" key={a.id}>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{a.name}</b>
                {(a.type || a.rarity) && <span className="hint">{[TYPE_NAME[a.type], RARITY_NAME[a.rarity]].filter(Boolean).join(" · ")}</span>}
              </div>
              {k ? <><FxChips fx={a.fx} />{a.note && <span className="hint">{a.note}</span>}</> : <span className="hint">Властивості невідомі.</span>}
              {stt === "noslot" && <div className="neg">Не діє: {cap ? `контейнерів лише ${cap}` : "немає вільного контейнера"}.</div>}
              {stt === "same" && <div className="neg">Не діє: такий самий уже працює, однакові не сумуються.</div>}
              <div className="row between">
                <Check checked={a.on} disabled={ro || (!a.on && used >= cap)} set={v => up(x => { x.artifacts[i].on = v; })}>У контейнері</Check>
                {!ro && !edit && <Btn sm pri={isOpen} onClick={() => setOpen(isOpen ? "" : a.id)}>{isOpen ? "Готово" : "Змінити"}</Btn>}
              </div>
              {(edit || isOpen) && !ro && <>
                {a.d && <span className="hint">{a.d}</span>}
                {st.gm && <Check checked={!a.secret} set={v => up(x => { x.artifacts[i].secret = !v; })}>Властивості відомі гравцю</Check>}
                <div><Confirm sm={false} label="Викинути" ask="Точно викинути?" title="Викинути артефакт" onConfirm={() => toast(`Викинуто: ${a.name}.`, up(x => { x.artifacts.splice(i, 1); }))} /></div>
              </>}
            </div>
          );
        })}
        {working.length > 0 && (
          <div className="pad artsum">
            <span className="lbl">Разом від артефактів</span>
            <FxChips fx={sum} />
            {unknownOn && <span className="hint">{ART_FX_INFO.some(f => sum[f.key] !== 0) ? "І ще щось від артефактів із невідомими властивостями." : "Діють артефакти з невідомими властивостями."}</span>}
          </div>
        )}
        {adding && (
          <div className="addf">
            {cat.artifacts.length ? <>
              <div className="row wrapg">
                <select className="in" aria-label="Який артефакт додати" value={picked?.id ?? ""} onChange={e => setPick(e.target.value)}>
                  {ART_TYPES.map(([t, tn]) => {
                    const xs = cat.artifacts.filter(x => x.type === t);
                    return xs.length ? <optgroup key={t} label={tn}>{xs.map(x => <option key={x.id} value={x.id}>{x.n}{x.p ? `, ${x.p} куп.` : ""}{hiddenMark(x.hidden)}</option>)}</optgroup> : null;
                  })}
                </select>
                <Btn pri onClick={add}>Додати</Btn>
                <Btn onClick={() => setAdding(false)}>Скасувати</Btn>
              </div>
              {picked && <span className="hint">{[RARITY_NAME[picked.rarity], picked.d].filter(Boolean).join(". ")}</span>}
              {picked && (st.gm || !picked.secret) ? <FxChips fx={picked.fx} /> : picked && <span className="hint">Властивості невідомі.</span>}
              {picked?.p ? <Check checked={buy} set={setBuy}>Купити: списати купони</Check> : null}
            </> : <>
              <p className="empty">Майстер ще не додав артефактів.</p>
              <div><Btn onClick={() => setAdding(false)}>Скасувати</Btn></div>
            </>}
          </div>
        )}
      </div>
    </Box>
  );
}
