import { useCampaign } from "../state/context";
import { Box, Btn, toast } from "./bits";

const SIGN_IN_ERRORS: Record<string, string> = {
  "auth/popup-blocked": "Браузер заблокував вікно входу. Дозволь спливні вікна для цього сайту.",
  "auth/unauthorized-domain": "Цю адресу ще не дозволено у Firebase.",
  "auth/network-request-failed": "Немає інтернету.",
};
const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function Login() {
  const [st, camp] = useCampaign();
  const signIn = () => camp.signIn().catch((err: { code?: string }) => {
    if (!SILENT.has(err?.code ?? "")) toast(SIGN_IN_ERRORS[err?.code ?? ""] ?? "Увійти не вдалося. Спробуй ще раз.");
  });
  return (
    <div>
      <header className="rt"><div className="formno">Настільна гра по Зоні · правила майстра</div><h1>Чарнік сталкера</h1></header>
      <div className="rgrid">
        <Box title="Вхід">
          <div className="pad">
            {!st.authReady ? <p className="hint">Перевіряю вхід.</p> : <>
              <p>Увійди через Google, щоб створити свого сталкера. Картка зберігається в базі й відкривається з будь-якого пристрою.</p>
              <div><Btn pri lg onClick={signIn}>Увійти через Google</Btn></div>
              <p className="hint">Якщо сторінка відкрилася всередині Telegram чи іншого застосунку, відкрий її у звичайному браузері: там Google не дає входити.</p>
            </>}
          </div>
        </Box>
        <Box title="Як це працює">
          <div className="ref"><ul>
            <li>Майстер створення веде за правилами: 16 балів характеристик, 18 балів навичок, 4000 купонів на спорядження.</li>
            <li>У картці є здоров'я з пораненнями, радіація, калькулятор пострілу, зброя, рюкзак і нотатки.</li>
            <li>Свою картку змінюєш тільки ти. Картки інших гравців видно всім учасникам, але лише для читання.</li>
            <li>Особисті нотатки бачиш тільки ти.</li>
          </ul></div>
        </Box>
      </div>
    </div>
  );
}
