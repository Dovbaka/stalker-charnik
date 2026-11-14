import { useRef, useState } from "react";
import { maxHp, migrate } from "../rules/character";
import { decode, encode } from "../rules/codes";
import { useCampaign } from "../state/context";
import { Area, Box, Btn, Check, Confirm, toast } from "./bits";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function Roster({ open, hasDraft, startWizard }: { open: (id: string) => void; hasDraft: boolean; startWizard: (fresh: boolean) => void }) {
  const [st, camp] = useCampaign();
  const [exp, setExp] = useState<{ id: string; code: string; noSecret: boolean } | null>(null);
  const [imp, setImp] = useState("");
  const codeBox = useRef<HTMLTextAreaElement>(null);

  const all = Object.values(st.entries)
    .map(e => ({ e, c: camp.charOf(e.id), own: camp.isMine(e.id) }))
    .filter(x => x.c)
    .sort((a, b) => a.c!.id.callsign.localeCompare(b.c!.id.callsign, "uk"));
  const my = all.filter(x => x.own), others = all.filter(x => !x.own);

  const makeCode = async (id: string, noSecret: boolean) => {
    setExp({ id, code: "", noSecret });
    const code = await encode(await camp.exportChar(id, !noSecret));
    setExp(cur => (cur && cur.id === id && cur.noSecret === noSecret ? { ...cur, code } : cur));
  };
  const copyCode = () => {
    if (!exp?.code) return;
    const fail = () => { codeBox.current?.focus(); codeBox.current?.select(); toast("Не скопіювалося. Код виділено."); };
    try { navigator.clipboard.writeText(exp.code).then(() => toast("Код скопійовано."), fail); } catch { fail(); }
  };
  const saveFile = async () => {
    if (!exp) return;
    const obj = await camp.exportChar(exp.id, !exp.noSecret);
    if (!obj) return;
    const callsign = String((obj.id as { callsign?: string })?.callsign || "stalker").replace(/[^\p{L}\p{N}_-]+/gu, "-") || "stalker";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: "zona-charnik", v: 1, char: obj }, null, 1)], { type: "application/json" }));
    a.download = `charnik-${callsign}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const doImport = async () => {
    const txt = imp.trim();
    if (!txt) { toast("Коду немає."); return; }
    let obj: unknown;
    try { obj = txt[0] === "{" ? JSON.parse(txt) : await decode(txt); }
    catch (err) { toast((err as Error)?.message === "old" ? "Цей браузер не вміє читати стиснутий код. Онови браузер." : "Код не читається. Перевір, що він скопійований повністю."); return; }
    if (isObj(obj) && isObj(obj.char)) obj = obj.char;
    if (!isObj(obj) || !obj.attrs || !obj.skills) { toast("Це не код персонажа."); return; }
    const secret = typeof obj.secret === "string" ? obj.secret : "";
    const c = migrate(obj);
    camp.create(c, secret);
    setImp(""); toast(`Створено з коду: «${c.id.callsign}».`);
  };
  const readFile = (file: File | undefined) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { setImp(String(rd.result || "")); toast("Файл прочитано."); };
    rd.onerror = () => toast("Файл не читається.");
    rd.readAsText(file);
  };

  const row = (x: (typeof all)[number]) => {
    const c = x.c!;
    const meta = [x.own ? "" : x.e.ownerName, `ОЗ ${c.hp}/${maxHp(c)}`].filter(Boolean).join(" · ");
    return (
      <div className="crow" key={x.e.id}>
        <div className="nm"><h3>{c.id.callsign || "Без позивного"}</h3><span className="hint">{meta}</span></div>
        <Btn pri={x.own} onClick={() => open(x.e.id)}>{x.own ? "Відкрити" : "Переглянути"}</Btn>
        {x.own && <>
          <Btn title="Код-копія персонажа" onClick={() => makeCode(x.e.id, false)}>Код</Btn>
          <Confirm sm={false} title="Видалити персонажа" onConfirm={() => { if (exp?.id === x.e.id) setExp(null); camp.remove(x.e.id); }} />
        </>}
      </div>
    );
  };
  const wait = <p className="empty">Завантажую картки.</p>;
  const expChar = exp ? camp.charOf(exp.id) : null;

  return (
    <div>
      <header className="top">
        <div className="who"><h1>Чарнік сталкера</h1></div>
        <div className="top-r"><span className="sync">{st.user?.name}</span><Btn sm onClick={() => camp.signOut()}>Вийти</Btn></div>
      </header>
      {st.error && <div className="warnbar" style={{ marginTop: 12 }}>{st.error}</div>}
      <div className="rgrid">
        <Box title="Мої сталкери">
          <div>
            {!st.loaded ? wait : my.length ? my.map(row) : <p className="empty">У тебе ще немає сталкера. Створи його за правилами майстра: 16 балів характеристик, 18 балів навичок і 4000 купонів на спорядження.</p>}
            <div className="addf"><div className="row wrapg">
              <Btn pri lg onClick={() => startWizard(true)}>Новий персонаж</Btn>
              {hasDraft && <Btn lg onClick={() => startWizard(false)}>Продовжити створення</Btn>}
            </div></div>
          </div>
        </Box>
        <Box title="Сталкери групи">
          <div>{!st.loaded ? wait : others.length ? others.map(row) : <p className="empty">Інших карток поки немає. Вони з'являться тут, коли гравці створять своїх сталкерів.</p>}</div>
        </Box>
        {exp && expChar && (
          <Box title={`Код-копія: ${expChar.id.callsign}`}>
            <div className="pad">
              <textarea ref={codeBox} className="in code" readOnly aria-label="Код персонажа" value={exp.code || "Готую код."} />
              <div className="row wrapg"><Btn pri onClick={copyCode}>Скопіювати код</Btn><Btn onClick={saveFile}>Зберегти файл</Btn><Btn onClick={() => setExp(null)}>Закрити</Btn></div>
              <Check checked={exp.noSecret} set={v => makeCode(exp.id, v)}>Без особистих нотаток</Check>
              <p className="hint">Це запасна копія всієї картки. З коду можна створити такого самого персонажа.</p>
            </div>
          </Box>
        )}
        <Box title="Створити з коду">
          <div className="pad">
            <Area className="code" value={imp} set={setImp} rows={4} label="Код персонажа" placeholder="Встав сюди код-копію персонажа" />
            <div className="row wrapg">
              <Btn pri onClick={doImport}>Створити з коду</Btn>
              <label className="btn" style={{ display: "inline-flex", alignItems: "center" }}>З файлу
                <input type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={e => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <p className="hint">З коду створюється новий персонаж, і він стає твоїм.</p>
          </div>
        </Box>
      </div>
    </div>
  );
}
