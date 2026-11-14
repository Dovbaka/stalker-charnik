import { useCampaign } from "../state/context";
import { Btn, Trefoil, toast } from "./bits";

// Google refuses to sign in inside the browsers built into Telegram and other apps, so the failures mention it.
const IN_APP = "Якщо сторінка відкрита в Telegram чи іншому застосунку, відкрий її у звичайному браузері.";
const SIGN_IN_ERRORS: Record<string, string> = {
  "auth/popup-blocked": `Браузер заблокував вікно входу. Дозволь спливні вікна для цього сайту. ${IN_APP}`,
  "auth/unauthorized-domain": "Цю адресу ще не дозволено у Firebase.",
  "auth/network-request-failed": "Немає інтернету.",
};
const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/** The front page: hazard tape, the trefoil, the name and one button. */
export function Login() {
  const [st, camp] = useCampaign();
  const signIn = () => camp.signIn().catch((err: { code?: string }) => {
    if (!SILENT.has(err?.code ?? "")) toast(SIGN_IN_ERRORS[err?.code ?? ""] ?? `Увійти не вдалося. ${IN_APP}`);
  });
  return (
    <div className="login">
      <div className="haz" aria-hidden="true" />
      <main className="login-c">
        <Trefoil />
        <h1>S.T.A.L.K.E.R.<span>TTRPG</span></h1>
        {st.authReady
          ? <Btn pri lg className="login-go" onClick={signIn}>Увійти через Google</Btn>
          : <div className="login-go login-wait">Перевіряю вхід…</div>}
      </main>
      <div className="haz" aria-hidden="true" />
    </div>
  );
}
