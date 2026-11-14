import { useState } from "react";
import { forViewer, gunGroups, itemGroups } from "../../rules/catalog";
import { MOD_CHOICES, MOD_INFO, SKILL_NAME, WEAPON_SKILLS, marketName, modPreset } from "../../rules/data";
import { addArmor, addGun, addMarketItem, newArmor, newMod, useCharge, useItem, wear, weightParts } from "../../rules/character";
import type { SkillKey } from "../../rules/types";
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
    <div className="col"><WeaponsBox {...api} /><ArmorsBox {...api} /></div>
    <div className="col"><ItemsBox {...api} /><ArtifactsBox {...api} /></div>
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
    <Lab name={name}><NumIn value={num(c.armors[i][key])} set={v => up(x => { x.armors[i][key] = v; })} /></Lab>;
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
              <span className="iw num">{kg(q * num(it.w))} кг</span>
              {!ro && !edit && <Btn sm pri={isOpen} onClick={() => setOpen(isOpen ? "" : it.id)}>{isOpen ? "Готово" : "Змінити"}</Btn>}
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

/** Kept simple on purpose: artefact effects wait for the GM's rules. */
function ArtifactsBox({ c, ro, edit, up }: SheetApi) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [fx, setFx] = useState("");
  if (!edit && !adding && c.artifacts.length === 0) {
    return ro ? null : <div><Btn link onClick={() => setAdding(true)}>+ Артефакт</Btn></div>;
  }
  const add = () => {
    const n = name.trim();
    if (!n) { toast("Немає назви."); return; }
    up(x => { x.artifacts.push({ id: uid(), name: n, fx: fx.trim() }); });
    setName(""); setFx(""); setAdding(false);
  };
  return (
    <Box title="Артефакти" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.artifacts.map((a, i) => (
          <div className="irow" key={a.id}>
            <div className="nm"><b>{a.name}</b>{a.fx && <span className="hint">{a.fx}</span>}</div>
            <Confirm onConfirm={() => toast(`Викинуто: ${a.name}.`, up(x => { x.artifacts.splice(i, 1); }))} />
          </div>
        ))}
        {adding && (
          <div className="addf">
            <div className="row wrapg">
              <input className="in" style={{ flex: "1 1 8em" }} placeholder="Назва" aria-label="Назва артефакту" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
              <input className="in" style={{ flex: "2 1 10em" }} placeholder="Що дає" aria-label="Ефект" value={fx} onChange={e => setFx(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
            </div>
            <div className="row"><Btn pri onClick={add}>Додати</Btn><Btn onClick={() => setAdding(false)}>Скасувати</Btn></div>
          </div>
        )}
      </div>
    </Box>
  );
}
