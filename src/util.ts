export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Parses a number typed by a person: accepts a comma, returns `d` for empty or broken input. */
export function num(v: unknown, d = 0): number {
  if (v == null || String(v).trim() === "") return d;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : d;
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const d10 = () => 1 + Math.floor(Math.random() * 10);

/** 4000 -> "4 000" with a narrow no-break space. */
export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Weight with one decimal and a comma, as it is written in Ukrainian. */
export const kg = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
/** "+ 5" / "− 2": a modifier written after "к10". */
export const sign = (v: number) => (v >= 0 ? "+ " : "− ") + Math.abs(v);

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function dateStr(t: number): string {
  if (!t) return "";
  const d = new Date(t), p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
