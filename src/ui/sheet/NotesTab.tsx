import { RAD_FX, RAD_STAGE } from "../../rules/data";
import { useCampaign } from "../../state/context";
import { Area, Box, Lab, Text } from "../bits";
import type { SheetApi } from "../Sheet";

export function NotesTab(api: SheetApi) {
  return <>
    <div className="col"><NotesBox {...api} />{!api.ro && <SecretBox {...api} />}</div>
    <div className="col"><AboutBox {...api} /></div>
    <div className="col"><RulesBox /></div>
  </>;
}

function NotesBox({ c, ro, up }: SheetApi) {
  return (
    <Box title="Нотатки" ro={ro}>
      <div className="pad"><Area className="ta" rows={8} value={c.notes} set={v => up(x => { x.notes = v; })} label="Нотатки" placeholder={ro ? "" : "Що сталося на сесії, імена, борги, домовленості."} /></div>
    </Box>
  );
}

/** Private notes live in their own document that only the owner can read. */
function SecretBox({ c }: SheetApi) {
  const [st, camp] = useCampaign();
  const ready = st.secret.ready && st.secret.id === c.cid;
  return (
    <Box title="Особисте" right={<span className="hint" style={{ textTransform: "none", letterSpacing: 0 }}>бачиш лише ти</span>}>
      <div className="pad">
        <Area className="ta" rows={6} disabled={!ready} value={ready ? st.secret.text : ""} set={v => camp.setSecret(v)} label="Особисті нотатки" placeholder={ready ? "Таємниці персонажа." : "Завантажую."} />
      </div>
    </Box>
  );
}

/** Who the character is. Edited in place, no "Правити" needed. */
function AboutBox({ c, ro, up }: SheetApi) {
  const i = c.id;
  return (
    <Box title="Про персонажа" ro={ro}>
      <div className="pad"><div className="fgrid">
        <Lab name="Позивний"><Text value={i.callsign} set={v => up(x => { x.id.callsign = v; })} /></Lab>
        <Lab name="Ім'я"><Text value={i.name} set={v => up(x => { x.id.name = v; })} /></Lab>
        <Lab name="Заняття"><Text value={i.role} set={v => up(x => { x.id.role = v; })} /></Lab>
        <Lab name="Вік"><Text value={i.age} set={v => up(x => { x.id.age = v; })} /></Lab>
        <Lab name="Зовнішність" wide><Area value={i.looks} set={v => up(x => { x.id.looks = v; })} /></Lab>
        <Lab name="Історія" wide><Area rows={4} value={i.about} set={v => up(x => { x.id.about = v; })} /></Lab>
      </div></div>
    </Box>
  );
}

const RAD_ROWS: [string, number][] = [["0–99", 0], ["100–299", 1], ["300–499", 2], ["500–799", 3], ["800–999", 4], ["1000", 5]];

/** Every rules reminder lives here, folded until it is needed. */
function RulesBox() {
  return (
    <Box title="Правила">
      <div className="rules">
        <details>
          <summary>Дії в бою</summary>
          <div className="body">
            <p>За хід: одна основна дія або дві додаткові, вільних скільки завгодно. Одну дію двічі за хід не роблять.</p>
            <p><b>Основні:</b> прицільний постріл чи кидок, ривок, дістати гвинтівку, перезарядка, захват, зламати замок, інструмент, прицільний удар, ремонт зброї.</p>
            <p><b>Додаткові:</b> швидкий постріл, рух, швидко вихопити гвинтівку, швидка перезарядка, дістати пістолет чи ніж, перша допомога, випити чи вколоти, швидкий удар, швидкий кидок, швидкий ремонт.</p>
            <p><b>Вільні:</b> помітити ворога, встати, сісти чи впасти, вихопити малу зброю, розмова.</p>
            <p><b>Дія у відповідь:</b> притримай дію й перерви хід того, в кого ініціатива нижча. Між раундами не зберігається.</p>
          </div>
        </details>
        <details>
          <summary>Удача</summary>
          <div className="body"><ul>
            <li>1 очко: +1 до своєї перевірки або −1 до перевірки ворога проти тебе.</li>
            <li>3 очки: перекинути свій к10 або змусити ворога перекинути його. Лишаєш кращий.</li>
            <li>5 очок: автоуспіх у своїй перевірці або автопровал ворога. Неможливе лишається неможливим.</li>
            <li>На світанку (6:00) +2. Після 12 годин у безпеці ще +1.</li>
          </ul></div>
        </details>
        <details>
          <summary>Поранення</summary>
          <div className="body"><div className="tw"><table><tbody>
            <tr><th>Втрачено</th><th>Ефект</th></tr>
            <tr><td>¼ здоров'я</td><td>−1 до всіх перевірок</td></tr>
            <tr><td>½</td><td>−1 до всіх характеристик, −2 до перевірок</td></tr>
            <tr><td>¾</td><td>характеристики навпіл, −2 до перевірок</td></tr>
            <tr><td>усе</td><td>непритомність</td></tr>
            <tr><td>⁵⁄₄</td><td>смерть</td></tr>
          </tbody></table></div></div>
        </details>
        <details>
          <summary>Лікування</summary>
          <div className="body"><ul>
            <li>1 ОЗ відновлюється за 2 години, у спокої з доглядом за годину, у небезпеці за 4.</li>
            <li>Перша допомога: к10 + Медицина проти 5, 9, 13 або 17 за кількістю ран.</li>
            <li>Бинт +2 проти кровотечі, аптечка +4, армійська й наукова +8.</li>
            <li>Зупинити кровотечу: Медицина проти 4, додаткова дія.</li>
          </ul></div>
        </details>
        <details>
          <summary>Радіація</summary>
          <div className="body"><div className="tw"><table><tbody>
            <tr><th>Рад</th><th>Стадія</th><th>Ефект</th></tr>
            {RAD_ROWS.map(r => <tr key={r[0]}><td className="num">{r[0]}</td><td>{RAD_STAGE[r[1]]}</td><td>{RAD_FX[r[1]]}</td></tr>)}
          </tbody></table></div><p className="hint">У чистому місці минає 1 рад за пів години. Антирад виводить 250, горілка 100.</p></div>
        </details>
        <details>
          <summary>Побут</summary>
          <div className="body"><ul>
            <li>День без їжі або води: −1 Тілобудова.</li>
            <li>Доба без сну: −1 до всього, крім Тілобудови. Друга: −1 Тілобудова і −2 до решти. На третю персонаж падає й спить.</li>
            <li>Алкоголь: кожна порція −1 до Мудрості, Реакції, Уважності і Спритності, щогодини повертається по 1. Нуль у будь-якій — непритомність.</li>
            <li>Вантаж понад Тілобудову × 10 кг: Спритність навпіл. Більше ніж у півтора раза не понести.</li>
          </ul></div>
        </details>
      </div>
    </Box>
  );
}
