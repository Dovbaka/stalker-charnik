import { useEffect, useState } from "react";
import { itemGroups, type Catalog } from "../rules/catalog";
import { ATTRS, ATTR_PTS, SKILL_GROUPS, SKILL_KEYS, SKILL_NAME, SKILL_PTS, marketName } from "../rules/data";
import { attrLeft, cartTotals, draftGearList, skillLeft, type Draft } from "../rules/character";
import { cx, fmt, kg, num } from "../util";
import { Area, Btn, Lab, NumIn, Stepper, Text, toast } from "./bits";

const STEPS = ["Хто", "Характеристики", "Навички", "Спорядження", "Підсумок"];

export function Wizard({ draft: w, cat, change, cancel, finish }: { draft: Draft; cat: Catalog; change: (fn: (w: Draft) => void) => void; cancel: () => void; finish: () => void }) {
  const d = w.d, st = w.step;
  const [sureCancel, setSureCancel] = useState(false);
  useEffect(() => { if (!sureCancel) return; const t = window.setTimeout(() => setSureCancel(false), 4000); return () => window.clearTimeout(t); }, [sureCancel]);

  const go = (n: number) => {
    const target = Math.max(0, Math.min(4, n));
    if (target > 0 && !d.id.callsign.trim()) { change(x => { x.step = 0; }); toast("Потрібен позивний."); return; }
    change(x => { x.step = target; });
    window.scrollTo(0, 0);
  };
  const tryCancel = () => {
    const touched = d.id.callsign.trim() || attrLeft(d) < ATTR_PTS - 5 || skillLeft(d) < SKILL_PTS;
    if (touched && !sureCancel) { setSureCancel(true); return; }
    cancel();
  };
  const tryFinish = () => { if (!d.id.callsign.trim()) { go(0); return; } finish(); };

  const t = cartTotals(w, cat), moneyLeft = d.money - t.cost, cap = d.attrs.til * 10;
  const aLeft = attrLeft(d), sLeft = skillLeft(d);

  let body;
  if (st === 0) {
    body = <>
      <h2>Хто йде в Зону</h2>
      <div className="pad">
        <p className="hint">Обов'язковий лише позивний.</p>
        <div className="fgrid">
          <Lab name="Позивний"><Text value={d.id.callsign} set={v => change(x => { x.d.id.callsign = v; })} placeholder="Як звуть у Зоні" /></Lab>
          <Lab name="Ім'я"><Text value={d.id.name} set={v => change(x => { x.d.id.name = v; })} placeholder="Необов'язково" /></Lab>
          <Lab name="Заняття"><Text value={d.id.role} set={v => change(x => { x.d.id.role = v; })} placeholder="Механік, науковиця, мисливець" /></Lab>
          <Lab name="Вік"><Text value={d.id.age} set={v => change(x => { x.d.id.age = v; })} /></Lab>
          <Lab name="Пул удачі"><NumIn value={num(d.luck.pool)} placeholder="5 + к4" set={v => change(x => { x.d.luck.pool = Math.min(99, Math.round(v)); })} /></Lab>
          <Lab name="Зовнішність" wide><Area value={d.id.looks} set={v => change(x => { x.d.id.looks = v; })} /></Lab>
          <Lab name="Коротко про себе" wide><Area rows={3} value={d.id.about} set={v => change(x => { x.d.id.about = v; })} /></Lab>
        </div>
        <div className="sep" />
        <div className="lbl">Здібність від майстра, якщо він її вже дав</div>
        <div className="fgrid">
          <Lab name="Назва" wide><Text value={w.ab.name} set={v => change(x => { x.ab.name = v; })} /></Lab>
          <Lab name="Що робить" wide><Area value={w.ab.text} set={v => change(x => { x.ab.text = v; })} /></Lab>
        </div>
      </div>
    </>;
  } else if (st === 1) {
    body = <>
      <h2>Розподіли 16 балів</h2>
      <div>
        <div className="pad">
          <p className="hint">Кожна характеристика від 1 до 6. Її додають до к10 у перевірках.</p>
          <div className="prot four">
            <div><b>{d.attrs.til * 5 + 10}</b><span>Здоров'я</span></div><div><b>{d.attrs.til * 10}</b><span>Вантаж, кг</span></div>
            <div><b>{3 + d.attrs.spr}</b><span>Рух, м</span></div><div><b>+{d.attrs.rea}</b><span>Ініціатива</span></div>
          </div>
        </div>
        {ATTRS.map(a => (
          <div className="wrow" key={a.key}>
            <div className="nm"><b>{a.name}</b><span className="hint">{a.long}</span></div>
            <Stepper value={d.attrs[a.key]} min={1} max={6} canInc={aLeft > 0} set={v => change(x => { x.d.attrs[a.key] = v; x.d.hp = x.d.attrs.til * 5 + 10; })} />
          </div>
        ))}
      </div>
    </>;
  } else if (st === 2) {
    body = <>
      <h2>Розподіли 18 балів</h2>
      <div>
        <div className="pad"><p className="hint">Рівень коштує стільки балів, який він за номером: перший 1, другий ще 2, третій ще 3. П'ятий рівень разом коштує 15.</p></div>
        {SKILL_GROUPS.map(g => (
          <div key={g.name}>
            <div className="wgh lbl">{g.name}</div>
            {g.skills.map(s => {
              const l = num(d.skills[s.key]);
              return (
                <div className={cx("wrow", l > 0 && "has")} key={s.key}>
                  <div className="nm"><b>{s.name}</b><span className="hint num">наступний рівень: {l + 1} б.</span></div>
                  <Stepper value={l} min={0} canInc={l + 1 <= sLeft} set={v => change(x => { x.d.skills[s.key] = v; })} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>;
  } else if (st === 3) {
    // only priced entries are sold at creation
    const row = (kind: "m" | "g" | "a", id: string, name: string, meta: string, price: number) => {
      const q = num(w.cart[kind][id]);
      return (
        <div className={cx("wrow", q > 0 && "has")} key={kind + id}>
          <div className="nm"><b>{name}</b><span className="hint num">{price} куп.{meta ? " · " + meta : ""}</span></div>
          <Stepper value={q} min={0} canInc={price <= moneyLeft} set={v => change(x => { x.cart[kind][id] = v; })} />
        </div>
      );
    };
    const items = cat.items.filter(m => m.p > 0), guns = cat.guns.filter(g => g.p > 0), armors = cat.armors.filter(a => a.p > 0);
    body = <>
      <h2>Закупись на 4000 купонів</h2>
      <div>
        <div className="pad">
          <p className="hint">Шкіряна куртка, одяг і ПДА є в кожного й ваги не мають. Невитрачені купони лишаються.</p>
          <div className="prot four">
            <div><b>{fmt(moneyLeft)}</b><span>Купонів</span></div><div><b className={t.weight > cap ? "neg" : ""}>{kg(t.weight)}</b><span>Вага, кг</span></div>
            <div><b>{cap}</b><span>Без штрафу</span></div><div><b>{kg(cap * 1.5)}</b><span>Межа</span></div>
          </div>
        </div>
        {itemGroups(items).map(g => (
          <div key={g}>
            <div className="wgh lbl">{g}</div>
            {items.map(m => m.g === g ? row("m", m.id, marketName(m), m.ammo ? "" : [kg(m.w ?? 0) + " кг", m.d].filter(Boolean).join(" · "), m.p) : null)}
          </div>
        ))}
        {armors.length > 0 && <>
          <div className="wgh lbl">Броня</div>
          {armors.map(a => row("a", a.id, a.n, [`кін ${a.kin} · кисл ${a.acid} · вог ${a.fire} · ел ${a.elec} · рад ${a.rad}`, kg(a.w) + " кг"].join(" · "), a.p))}
        </>}
        <div className="wgh lbl">Зброя</div>
        {guns.map(g => row("g", g.id, g.n, [g.dmg ? "шкода " + g.dmg : "", g.mag ? "магазин " + g.mag : "", g.cal, kg(g.w) + " кг"].filter(Boolean).join(" · "), g.p))}
      </div>
    </>;
  } else {
    const skills = SKILL_KEYS.filter(k => num(d.skills[k]) > 0).map(k => `${SKILL_NAME[k]} ${d.skills[k]}`).join(", ") || "жодної";
    const gear = draftGearList(w, cat).join(", ") || "нічого";
    body = <>
      <h2>Перевір і створи</h2>
      <div className="pad">
        <div className="sum"><div className="lbl">Сталкер</div><p><b>{d.id.callsign}</b>{d.id.role ? ", " + d.id.role : ""}{d.id.age ? `, ${d.id.age} р.` : ""}</p>
          <p className="hint">Пул удачі: {num(d.luck.pool)}</p></div>
        <div className="sum"><div className="lbl">Характеристики</div><p className="num">{ATTRS.map(a => `${a.name} ${d.attrs[a.key]}`).join(", ")}</p>
          {aLeft > 0 && <p className="amber">Не розподілено {aLeft} б. Вони збережуться як вільні бали.</p>}</div>
        <div className="sum"><div className="lbl">Навички</div><p className="num">{skills}</p>
          {sLeft > 0 && <p className="amber">Не розподілено {sLeft} б. Вони збережуться як вільні бали.</p>}</div>
        <div className="sum"><div className="lbl">Спорядження</div><p>{gear}</p><p className="hint num">Лишається {fmt(moneyLeft)} куп., вага {kg(t.weight)} з {cap} кг.</p></div>
        {w.ab.name.trim() && <div className="sum"><div className="lbl">Здібність</div><p><b>{w.ab.name}</b>{w.ab.text ? ". " + w.ab.text : ""}</p></div>}
      </div>
    </>;
  }

  const mid = st === 1 ? <>лишилось балів <b>{aLeft}</b></> : st === 2 ? <>лишилось балів <b>{sLeft}</b></> : st === 3 ? <>купонів <b>{fmt(moneyLeft)}</b></> : null;

  return (
    <div className="sc-wiz">
      <header className="wtop">
        <div className="formno">Новий сталкер · крок {st + 1} з 5</div>
        <h1>{STEPS[st]}</h1>
        <ol className="steps">
          {STEPS.map((n, i) => (
            <li key={n}><button type="button" className={cx("tab", i === st && "on", i < st && "done")} aria-current={i === st ? "step" : undefined} aria-label={`Крок ${i + 1}: ${n}`} onClick={() => go(i)}>{i + 1}<span>. {n}</span></button></li>
          ))}
        </ol>
      </header>
      <section className="wz">{body}</section>
      <div className="wnav">
        {st === 0 ? <Btn dng={sureCancel} onClick={tryCancel}>{sureCancel ? "Точно?" : "Скасувати"}</Btn> : <Btn onClick={() => go(st - 1)}>Назад</Btn>}
        <div className="mid">{mid}</div>
        {st === 4 ? <Btn pri lg onClick={tryFinish}>Створити картку</Btn> : <Btn pri lg onClick={() => go(st + 1)}>Далі</Btn>}
      </div>
    </div>
  );
}
