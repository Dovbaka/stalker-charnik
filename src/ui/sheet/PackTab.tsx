import { useState } from "react";
import { MARKET, marketName } from "../../rules/data";
import { addMarketItem, useCharge, useItem, weightParts } from "../../rules/character";
import { cx, fmt, kg, num, uid } from "../../util";
import { Box, Btn, Check, Confirm, Lab, Meter, NumIn, Stepper, Text, toast } from "../bits";
import type { SheetApi } from "../Sheet";

export function PackTab(api: SheetApi) {
  return <><MoneyBox {...api} /><ItemsBox {...api} /><ArtifactsBox {...api} /></>;
}

/** Coupons and the load share a box: both answer "can I take this". */
function MoneyBox({ c, d, ro, up }: SheetApi) {
  const [amt, setAmt] = useState("");
  const move = (dir: 1 | -1) => {
    const n = Math.round(num(amt, NaN));
    if (!(n > 0)) { toast("Впиши суму."); return; }
    if (dir < 0 && n > c.money) { toast("Стільки купонів немає."); return; }
    up(x => { x.money += n * dir; });
    setAmt("");
  };
  const limit = d.cap * 1.5;
  const parts = weightParts(c);
  const made = [["зброя", parts.weapons], ["речі", parts.items], ["броня", parts.armor]].filter(([, w]) => (w as number) > 0).map(([n, w]) => `${n} ${kg(w as number)}`).join(" · ");
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
      <Box title="Вантаж" ro={ro} right={d.over ? <span className={d.over === 2 ? "neg" : "amber"}>{d.over === 2 ? "Понад межу" : "Спритність ÷2"}</span> : undefined}>
        <div className="pad">
          <div className="row between base wrapg"><span className="big">{kg(d.weight)}<small> / {d.cap} кг</small></span><span className="hint num">{made || "нічого"}</span></div>
          <Meter value={d.weight} max={limit} cls={cx("load", d.over === 1 && "over", d.over === 2 && "limit")} marks={[d.cap]} label={`Вантаж ${kg(d.weight)} кг: без штрафу до ${d.cap}, межа ${kg(limit)}`} />
        </div>
      </Box>
    </div>
  );
}

function ItemsBox({ c, ro, edit, up }: SheetApi) {
  const [adding, setAdding] = useState(false);
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
    <Box title="Речі" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.items.length === 0 && !adding && <p className="empty">Рюкзак порожній.</p>}
        {c.items.map((it, i) => {
          const q = num(it.qty);
          return (
            <div className={cx("irow", !q && "zero")} key={it.id}>
              <div className="nm">
                <b>{it.name}</b>
                {it.uses != null && <span className="hint">у початому: {q > 0 ? num(it.uses) : 0}</span>}
              </div>
              {it.fx && <Btn sm pri disabled={q <= 0} onClick={() => { let msg = ""; up(x => { msg = useItem(x, it.id); }); if (msg) toast(msg); }}>Вжити</Btn>}
              {it.uses != null && !it.fx && <Btn sm disabled={q <= 0} onClick={() => up(x => useCharge(x.items[i]))}>Використати</Btn>}
              <Stepper value={q} min={0} max={9999} set={v => up(x => { x.items[i].qty = v; })} />
              <span className="iw num">{kg(q * num(it.w))} кг</span>
              {edit && (
                <div className="fgrid" style={{ flex: "1 1 100%" }}>
                  <Lab name="Назва"><Text value={it.name} set={v => up(x => { x.items[i].name = v; })} /></Lab>
                  <Lab name="Вага однієї, кг"><NumIn value={num(it.w)} set={v => up(x => { x.items[i].w = v; })} /></Lab>
                  <Lab name="Нотатка" wide><Text value={it.note} set={v => up(x => { x.items[i].note = v; })} /></Lab>
                  <div className="wide"><Confirm sm={false} label="Викинути" ask="Точно викинути?" title="Викинути річ" onConfirm={() => up(x => { x.items.splice(i, 1); })} /></div>
                </div>
              )}
            </div>
          );
        })}
        {adding && <>
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
    if (!n) { toast("Впиши назву артефакту."); return; }
    up(x => { x.artifacts.push({ id: uid(), name: n, fx: fx.trim() }); });
    setName(""); setFx(""); setAdding(false);
  };
  return (
    <Box title="Артефакти" ro={ro} right={!ro && !adding ? <Btn sm onClick={() => setAdding(true)}>+ Додати</Btn> : undefined}>
      <div>
        {c.artifacts.map((a, i) => (
          <div className="irow" key={a.id}>
            <div className="nm"><b>{a.name}</b>{a.fx && <span className="hint">{a.fx}</span>}</div>
            <Confirm onConfirm={() => up(x => { x.artifacts.splice(i, 1); })} />
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
