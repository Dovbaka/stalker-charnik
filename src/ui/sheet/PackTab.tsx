import { useState } from "react";
import { MARKET, marketName } from "../../rules/data";
import { addMarketItem, useCharge, useItem } from "../../rules/character";
import { cx, fmt, kg, num, uid } from "../../util";
import { Bar, Box, Btn, Check, Confirm, Lab, NumIn, Stepper, Text, toast } from "../bits";
import type { SheetApi } from "../Sheet";

export function PackTab(api: SheetApi) {
  return <><MoneyBox {...api} /><CarryBox {...api} /><ItemsBox {...api} /><ArtifactsBox {...api} /></>;
}

function MoneyBox({ c, ro, up }: SheetApi) {
  const [amt, setAmt] = useState("");
  const move = (dir: 1 | -1) => {
    const n = Math.round(num(amt, NaN));
    if (!(n > 0)) { toast("Впиши суму."); return; }
    if (dir < 0 && n > c.money) { toast("Стільки купонів немає."); return; }
    up(x => { x.money += n * dir; });
    setAmt("");
  };
  return (
    <Box title="Купони" ro={ro}>
      <div className="pad">
        <div className="big">{fmt(c.money)}<small> куп.</small></div>
        <div className="row wrapg">
          <input className="in w6 num" inputMode="numeric" placeholder="сума" aria-label="Сума" value={amt} onChange={e => setAmt(e.target.value)} />
          <Btn pri onClick={() => move(1)}>+ Дохід</Btn><Btn onClick={() => move(-1)}>− Витрата</Btn>
        </div>
      </div>
    </Box>
  );
}

function CarryBox({ d, ro }: SheetApi) {
  const limit = d.cap * 1.5;
  const cls = d.over === 2 ? "bad" : d.over === 1 ? "warn" : "";
  const text = d.over === 2 ? "Понад межу: стільки не понести." : d.over === 1 ? "Перевантаження: Спритність удвічі менша." : "Без штрафу.";
  return (
    <Box title="Вантаж" ro={ro}>
      <div className="pad">
        <div className="row between end"><div className={cx("big", cls)}>{kg(d.weight)}<small>/{d.cap} кг</small></div><div className={d.over ? "neg" : "hint"} style={{ textAlign: "right" }}>{text}</div></div>
        <Bar pct={(d.weight / (limit || 1)) * 100} cls={cls} ticks={[66.67]} label={`Вантаж ${kg(d.weight)} з ${d.cap} кг`} />
        <div className="hint">До {d.cap} кг без штрафу, до {kg(limit)} кг зі Спритністю навпіл. Куртка, одяг і ПДА не рахуються.</div>
      </div>
    </Box>
  );
}

function ItemsBox({ c, ro, edit, up }: SheetApi) {
  const [pick, setPick] = useState("0");
  const [buy, setBuy] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [weight, setWeight] = useState("");
  const addFromMarket = () => {
    const m = MARKET[Number(pick)];
    if (!m) return;
    if (buy && c.money < m.p) { toast(`Не вистачає купонів: треба ${m.p}.`); return; }
    up(x => { if (buy) x.money -= m.p; addMarketItem(x, m); });
    toast(buy ? `Куплено: ${marketName(m)}, −${m.p} куп.` : `Додано: ${marketName(m)}.`);
  };
  const addOwn = () => {
    const n = name.trim();
    if (!n) { toast("Впиши назву речі."); return; }
    up(x => { x.items.push({ id: uid(), name: n, qty: Math.max(1, Math.round(num(qty, 1))), w: Math.max(0, num(weight, 0)), note: "" }); });
    setName(""); setQty(""); setWeight("");
  };
  return (
    <Box title="Рюкзак" ro={ro}>
      <div>
        {c.items.length === 0 && <p className="empty">Рюкзак порожній. Додай речі зі списку майстра або впиши свої.</p>}
        {c.items.map((it, i) => {
          const q = num(it.qty);
          return (
            <div className={cx("irow", !q && "zero")} key={it.id}>
              <div className="nm">
                <b>{it.name}</b>
                {it.note && <span className="hint">{it.note}</span>}
                {it.uses != null && <span className="hint">використань у початому: {num(it.uses)}</span>}
              </div>
              <Stepper value={q} min={0} max={9999} set={v => up(x => { x.items[i].qty = v; })} />
              <span className="iw num">{kg(q * num(it.w))} кг</span>
              {it.fx && q > 0 && <Btn sm pri onClick={() => { let msg = ""; up(x => { msg = useItem(x, it.id); }); if (msg) toast(msg); }}>Вжити</Btn>}
              {it.uses != null && !it.fx && q > 0 && <Btn sm onClick={() => up(x => useCharge(x.items[i]))}>Використати</Btn>}
              <Confirm onConfirm={() => up(x => { x.items.splice(i, 1); })} />
              {edit && (
                <div className="fgrid" style={{ flex: "1 1 100%" }}>
                  <Lab name="Назва"><Text value={it.name} set={v => up(x => { x.items[i].name = v; })} /></Lab>
                  <Lab name="Вага однієї, кг"><NumIn value={num(it.w)} set={v => up(x => { x.items[i].w = v; })} /></Lab>
                  <Lab name="Нотатка" wide><Text value={it.note} set={v => up(x => { x.items[i].note = v; })} /></Lab>
                </div>
              )}
            </div>
          );
        })}
        <div className="addf">
          <div className="lbl">З ринку майстра</div>
          <div className="row wrapg">
            <select className="in" aria-label="Що додати" value={pick} onChange={e => setPick(e.target.value)}>{MARKET.map((m, i) => <option key={i} value={i}>{marketName(m)}, {m.p} куп.</option>)}</select>
            <Btn pri onClick={addFromMarket}>Додати</Btn>
          </div>
          <Check checked={buy} set={setBuy}>Купити: списати купони</Check>
        </div>
        <div className="addf">
          <div className="lbl">Своя річ</div>
          <div className="row wrapg">
            <input className="in" style={{ flex: "1 1 9em" }} placeholder="Назва" aria-label="Назва речі" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addOwn(); }} />
            <input className="in w4 num" inputMode="numeric" placeholder="шт" aria-label="Кількість" value={qty} onChange={e => setQty(e.target.value)} />
            <input className="in w4 num" inputMode="decimal" placeholder="кг" aria-label="Вага однієї, кг" value={weight} onChange={e => setWeight(e.target.value)} />
            <Btn pri onClick={addOwn}>Додати</Btn>
          </div>
        </div>
      </div>
    </Box>
  );
}

function ArtifactsBox({ c, ro, up }: SheetApi) {
  const [name, setName] = useState("");
  const [fx, setFx] = useState("");
  const add = () => {
    const n = name.trim();
    if (!n) { toast("Впиши назву артефакту."); return; }
    up(x => { x.artifacts.push({ id: uid(), name: n, fx: fx.trim() }); });
    setName(""); setFx("");
  };
  return (
    <Box title="Артефакти" ro={ro}>
      <div>
        {c.artifacts.length === 0 && <p className="empty">Артефактів немає. У Зону з ними не заходять.</p>}
        {c.artifacts.map((a, i) => (
          <div className="irow" key={a.id}>
            <div className="nm"><b>{a.name}</b>{a.fx && <span className="hint">{a.fx}</span>}</div>
            <Confirm onConfirm={() => up(x => { x.artifacts.splice(i, 1); })} />
          </div>
        ))}
        <div className="addf">
          <div className="row wrapg">
            <input className="in" style={{ flex: "1 1 8em" }} placeholder="Назва" aria-label="Назва артефакту" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
            <input className="in" style={{ flex: "2 1 10em" }} placeholder="Що дає" aria-label="Ефект" value={fx} onChange={e => setFx(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
            <Btn pri onClick={add}>Додати</Btn>
          </div>
          <div className="hint">Контейнерів у броні: {num(c.armor.slots)}. Зміну характеристик від артефакту внеси через «Правити», поле «артефакти й інше».</div>
        </div>
      </div>
    </Box>
  );
}
