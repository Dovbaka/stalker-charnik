// Small building blocks shared by every screen. Class names come from styles.css.
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clamp, cx, num } from "../util";

/* ---------- toast ---------- */
interface ToastMsg { text: string; undo?: (() => void) | null }
const toastSubs = new Set<(m: ToastMsg) => void>();
/** A short line at the bottom. With `undo` it also offers «Скасувати» for a few seconds, then goes away by itself. */
export const toast = (text: string, undo?: (() => void) | null) => { toastSubs.forEach(f => f({ text, undo })); };
export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    let t = 0;
    const show = (m: ToastMsg) => { setMsg(m); window.clearTimeout(t); t = window.setTimeout(() => setMsg(null), m.undo ? 4500 : 3600); };
    toastSubs.add(show);
    return () => { toastSubs.delete(show); window.clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div className={cx("toast", msg.undo && "undo")} role="status" aria-live="polite">
      <span>{msg.text}</span>
      {msg.undo && <button type="button" className="toast-btn" onClick={() => { msg.undo?.(); setMsg(null); }}>Скасувати</button>}
    </div>
  );
}

/* ---------- a value remembered in this browser ---------- */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw == null ? initial : { ...(initial as object), ...JSON.parse(raw) } as T; } catch { return initial; }
  });
  return [v, next => { setV(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private window */ } }];
}

/* ---------- controls ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { pri?: boolean; dng?: boolean; sm?: boolean; lg?: boolean; sq?: boolean; link?: boolean };
export function Btn({ pri, dng, sm, lg, sq, link, className, ...rest }: BtnProps) {
  return <button type="button" className={cx("btn", pri && "pri", dng && "dng", sm && "sm", lg && "lg", sq && "sq", link && "link", className)} {...rest} />;
}

/** −  value  + */
export function Stepper({ value, set, min = -9999, max = 9999, show, canInc = true, canDec = true }: {
  value: number; set: (v: number) => void; min?: number; max?: number; show?: ReactNode; canInc?: boolean; canDec?: boolean;
}) {
  return (
    <span className="step">
      <Btn sq aria-label="Менше" disabled={!canDec || value <= min} onClick={() => set(clamp(value - 1, min, max))}>−</Btn>
      <output>{show ?? value}</output>
      <Btn sq aria-label="Більше" disabled={!canInc || value >= max} onClick={() => set(clamp(value + 1, min, max))}>+</Btn>
    </span>
  );
}

export function Text({ value, set, placeholder, label, onEnter, className }: { value: string; set: (v: string) => void; placeholder?: string; label?: string; onEnter?: () => void; className?: string }) {
  return <input className={cx("in", className)} value={value} placeholder={placeholder} aria-label={label}
    onChange={e => set(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }} />;
}
export function Area({ value, set, rows = 2, placeholder, label, className, disabled }: { value: string; set: (v: string) => void; rows?: number; placeholder?: string; label?: string; className?: string; disabled?: boolean }) {
  return <textarea className={cx("in", className)} rows={rows} value={value} placeholder={placeholder} aria-label={label} disabled={disabled} onChange={e => set(e.target.value)} />;
}
/** A number typed by hand: keeps what the person types and reports a clean number. */
export function NumIn({ value, set, min = 0, className, label, placeholder }: { value: number; set: (v: number) => void; min?: number; className?: string; label?: string; placeholder?: string }) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { if (num(raw, NaN) !== value) setRaw(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className={cx("in", className)} inputMode="decimal" value={raw} placeholder={placeholder} aria-label={label}
    onChange={e => { setRaw(e.target.value); set(Math.max(min, num(e.target.value, 0))); }} />;
}
export function Lab({ name, wide, children }: { name: string; wide?: boolean; children: ReactNode }) {
  return <label className={cx("fl", wide && "wide")}><span>{name}</span>{children}</label>;
}
export function Check({ checked, set, children, wide, disabled }: { checked: boolean; set: (v: boolean) => void; children: ReactNode; wide?: boolean; disabled?: boolean }) {
  return <label className={cx("chk", wide && "wide", disabled && "off")}><input type="checkbox" checked={checked} disabled={disabled} onChange={e => set(e.target.checked)} /> {children}</label>;
}
/** a chip that is either on or off */
export function Tg({ on, onClick, mod, children, disabled }: { on: boolean; onClick: () => void; mod?: string; children: ReactNode; disabled?: boolean }) {
  return <button type="button" className={cx("tg", on && "on")} aria-pressed={on} disabled={disabled} onClick={onClick}>{children}{mod ? <i>{mod}</i> : null}</button>;
}
/**
 * A big number that turns into a field when tapped, so a value can be typed in directly (0..max).
 * The field takes the number's place and size: nothing around it moves.
 */
export function EditNum({ value, min = 0, max, set, label, className, suffix }: { value: number; min?: number; max: number; set: (v: number) => void; label: string; className?: string; suffix?: ReactNode }) {
  const [raw, setRaw] = useState<string | null>(null);
  const commit = () => {
    if (raw != null && raw.trim() !== "") set(clamp(Math.round(num(raw, value)), min, max));
    setRaw(null);
  };
  return (
    <span className={cx("big editnum", className)}>
      {raw == null
        ? <button type="button" aria-label={`${label}: ${value}. Змінити`} title={label} onClick={() => setRaw(String(value))}>{value}</button>
        : <input autoFocus inputMode="numeric" aria-label={label} value={raw} onChange={e => setRaw(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setRaw(null); }} onFocus={e => e.target.select()} />}
      {suffix}
    </span>
  );
}

/** A destructive button that asks once more before it acts. */
export function Confirm({ onConfirm, label = "×", ask = "Видалити?", title = "Видалити", sm = true }: { onConfirm: () => void; label?: string; ask?: string; title?: string; sm?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = window.setTimeout(() => setArmed(false), 4000); return () => window.clearTimeout(t); }, [armed]);
  return <Btn sm={sm} dng={armed} title={title} aria-label={title} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? ask : label}</Btn>;
}

/* ---------- display ---------- */
/** A ruled box. `ro` switches every control inside it off; `right` sits at the end of the title strip. */
export function Box({ title, ro, right, children }: { title: string; ro?: boolean; right?: ReactNode; children: ReactNode }) {
  return <section className="box"><h2><span>{title}</span>{right}</h2><fieldset disabled={ro}>{children}</fieldset></section>;
}

/** A horizontal gauge from 0 to `max`, with notches and their numbers underneath. */
export function Meter({ value, max, cls, marks = [], label, tint, showMax = true }: {
  value: number; max: number; cls?: string; marks?: number[]; label: string; tint?: string; showMax?: boolean;
}) {
  const at = (v: number) => clamp((v / (max || 1)) * 100, 0, 100);
  return (
    <div>
      <div className={cx("meter", cls)} role="img" aria-label={label} style={tint ? { background: tint } : undefined}>
        <i style={{ width: at(value) + "%" }} />
        {marks.map(m => <b key={m} style={{ left: at(m) + "%" }} />)}
      </div>
      <div className="scale" aria-hidden="true">
        <span className="first">0</span>
        {marks.map(m => <span key={m} style={{ left: at(m) + "%" }}>{m}</span>)}
        {showMax && <span className="end" style={{ left: "100%" }}>{max}</span>}
      </div>
    </div>
  );
}

/** ●●●○○: `on` filled out of `of`. */
export function Dots({ on, of, cls = "dots" }: { on: number; of: number; cls?: string }) {
  const n = Math.max(0, Math.min(on, of));
  return <span className={cls} aria-hidden="true">{"●".repeat(n)}<span className="off">{"●".repeat(Math.max(0, of - n))}</span></span>;
}
export function KV({ k, children }: { k: ReactNode; children: ReactNode }) {
  return <div className="kv"><span>{k}</span>{children}</div>;
}
const BLADE = "M9.53-5.5A11 11 0 0 1 9.53 5.5L3.46 2A4 4 0 0 0 3.46-2Z";
export function Trefoil({ className = "tre" }: { className?: string }) {
  return <svg className={className} viewBox="-12 -12 24 24" aria-hidden="true"><g fill="currentColor"><circle r="2.3" />{[90, 210, 330].map(a => <path key={a} d={BLADE} transform={`rotate(${a})`} />)}</g></svg>;
}

/** A three-leaf clover, the mark of luck. */
export function Clover({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor"><circle cx="12" cy="7" r="4.2" /><circle cx="7.2" cy="13" r="4.2" /><circle cx="16.8" cy="13" r="4.2" /></g>
      <path d="M12 13c0 4 1 6.5 3 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Two boot prints, the mark of movement. */
export function Steps({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor"><ellipse cx="7.5" cy="10" rx="3" ry="4.6" /><ellipse cx="7.5" cy="18.3" rx="2.4" ry="2.3" /><ellipse cx="16.5" cy="5.6" rx="3" ry="4.6" /><ellipse cx="16.5" cy="13.9" rx="2.4" ry="2.3" /></g>
    </svg>
  );
}
