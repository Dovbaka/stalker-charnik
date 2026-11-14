import { useEffect, useRef } from "react";
import { HOURS_PER_HP, REST0, applyRest, planRest, type RestCare, type RestOpts, type Supply } from "../../rules/rest";
import { Btn, Check, KV, Stepper, Tg, toast, usePersisted } from "../bits";
import type { SheetApi } from "../Sheet";

const CARE: [RestCare, string][] = [["care", "З доглядом"], ["normal", "Звичайно"], ["danger", "У небезпеці"]];
const SUPPLY: [Supply, string][] = [["pack", "З рюкзака"], ["other", "Деінде"], ["none", "Нема"]];

const change = (a: number, b: number, unit = "") => (a === b ? null : `${a} → ${b}${unit}`);

/** Rest: pick the conditions, see what will change, then confirm. Everything the rules tie to time happens at once. */
export function RestDialog({ c, up, close }: SheetApi & { close: () => void }) {
  const [o, setO] = usePersisted<RestOpts>("charnik.rest", REST0);
  const set = (patch: Partial<RestOpts>) => setO({ ...o, ...patch });
  const r = planRest(c, o);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const rows: [string, string | null][] = [
    ["Здоров'я", change(r.hp[0], r.hp[1])],
    ["Удача", change(r.luck[0], r.luck[1])],
    ["Радіація", change(r.rad[0], r.rad[1])],
    ["Алкоголь", change(r.vodka[0], r.vodka[1])],
    ["Сон", r.slept && c.noSleep > 0 ? "відновлено" : null],
    ["З'їдено", r.eaten.length ? r.eaten.join(", ") : null],
    ["Випито", r.drunk.length ? r.drunk.join(", ") : null],
  ];
  const shown = rows.filter(x => x[1]);
  const confirm = () => {
    up(x => { applyRest(x, o); });
    toast("Відпочинок записано.");
    close();
  };

  return (
    <div className="overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog box" role="dialog" aria-modal="true" aria-labelledby="rest-title" tabIndex={-1} ref={box}>
        <h2 id="rest-title"><span>Відпочити</span><Btn sm aria-label="Закрити" onClick={close}>×</Btn></h2>
        <div className="pad">
          <KV k="Скільки годин"><Stepper value={o.hours} min={1} max={24} set={v => set({ hours: v, dawn: v >= 6 ? o.dawn : false })} /></KV>
          <div className="seg">
            {[1, 4, 8].map(h => <Tg key={h} on={o.hours === h} onClick={() => set({ hours: h, dawn: h >= 6 })}>{h === 1 ? "Привал, 1 год" : h === 4 ? "4 год" : "Ніч, 8 год"}</Tg>)}
          </div>
          <div className="cgroup">
            <div className="lbl">Умови</div>
            <div className="seg">{CARE.map(([k, n]) => <Tg key={k} on={o.care === k} mod={`1 ОЗ / ${HOURS_PER_HP[k]} год`} onClick={() => set({ care: k })}>{n}</Tg>)}</div>
            <Check checked={o.clean} set={v => set({ clean: v })}>Чисте місце: радіація −2 за годину</Check>
          </div>
          <div className="cgroup">
            <Check checked={o.dawn} set={v => set({ dawn: v, safe12: v && o.safe12 })}>Настає світанок: новий день, удача +2</Check>
            <Check disabled={!o.dawn} checked={o.dawn && o.safe12} set={v => set({ safe12: v })}>Понад 12 годин у безпеці: удача ще +1</Check>
            <div className="lbl" style={{ visibility: o.dawn ? "visible" : "hidden" }}>Їжа на день</div>
            <div className="seg" style={{ visibility: o.dawn ? "visible" : "hidden" }}>{SUPPLY.map(([k, n]) => <Tg key={k} on={o.food === k} onClick={() => set({ food: k })}>{n}</Tg>)}</div>
            <div className="lbl" style={{ visibility: o.dawn ? "visible" : "hidden" }}>Вода на день</div>
            <div className="seg" style={{ visibility: o.dawn ? "visible" : "hidden" }}>{SUPPLY.map(([k, n]) => <Tg key={k} on={o.water === k} onClick={() => set({ water: k })}>{n}</Tg>)}</div>
          </div>
          <div className="cgroup">
            <div className="lbl">Що зміниться</div>
            {shown.length ? shown.map(([k, v]) => <KV key={k} k={k}><span className="num">{v}</span></KV>) : <span className="hint">Нічого.</span>}
            {r.warnings.map(w => <span key={w} className="neg">{w}</span>)}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Btn onClick={close}>Скасувати</Btn>
            <Btn pri onClick={confirm}>Відпочити</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
