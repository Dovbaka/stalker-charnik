// Backup codes: "Z1." + base64url(raw deflate of JSON), or "Z0." + base64url(JSON) where the browser cannot compress.

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (str: string): Uint8Array<ArrayBuffer> => {
  const b = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};
const pipe = async (bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function encode(obj: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(obj)) as Uint8Array<ArrayBuffer>;
  try {
    if (typeof CompressionStream === "function") return "Z1." + b64(await pipe(raw, new CompressionStream("deflate-raw")));
  } catch { /* fall through to the plain form */ }
  return "Z0." + b64(raw);
}

/** Throws Error("fmt") for text that holds no code and Error("old") where the browser cannot inflate. */
export async function decode(text: string): Promise<unknown> {
  const m = String(text).replace(/\s+/g, "").match(/Z([01])\.([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("fmt");
  const bytes = unb64(m[2]);
  if (m[1] === "0") return JSON.parse(new TextDecoder().decode(bytes));
  if (typeof DecompressionStream !== "function") throw new Error("old");
  return JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream("deflate-raw"))));
}
