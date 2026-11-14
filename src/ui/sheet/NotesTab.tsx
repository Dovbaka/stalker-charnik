import { RAD_FX, RAD_STAGE } from "../../rules/data";
import { useCampaign } from "../../state/context";
import { Area, Box } from "../bits";
import type { SheetApi } from "../Sheet";

export function NotesTab(api: SheetApi) {
  return <><NotesBox {...api} />{!api.ro && <SecretBox {...api} />}<RulesBox /></>;
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
    <Box title="Особисте">
      <div className="pad">
        <Area className="ta" rows={8} disabled={!ready} value={ready ? st.secret.text : ""} set={v => camp.setSecret(v)} label="Особисті нотатки" placeholder={ready ? "Таємниці персонажа, яких не знають інші гравці." : "Завантажую."} />
        <div className="hint">Цей блок бачиш тільки ти. Іншим учасникам чарнік його не показує.</div>
      </div>
    </Box>
  );
}

const RAD_ROWS: [string, number][] = [["0–99", 0], ["100–299", 1], ["300–499", 2], ["500–799", 3], ["800–999", 4], ["1000", 5]];

function RulesBox() {
  return (
    <Box title="Шпаргалка">
      <div className="ref">
        <div><h3>Поранення</h3><div className="tw"><table><tbody>
          <tr><th>Втрачено</th><th>Ефект</th></tr>
          <tr><td>¼ здоров'я</td><td>−1 до всіх перевірок</td></tr>
          <tr><td>½</td><td>−1 до всіх характеристик, −2 до перевірок</td></tr>
          <tr><td>¾</td><td>характеристики навпіл, −2 до перевірок</td></tr>
          <tr><td>усе</td><td>непритомність</td></tr>
          <tr><td>⁵⁄₄</td><td>смерть</td></tr>
        </tbody></table></div></div>
        <div><h3>Радіація</h3><div className="tw"><table><tbody>
          <tr><th>Рад</th><th>Стадія</th><th>Ефект</th></tr>
          {RAD_ROWS.map(r => <tr key={r[0]}><td className="num">{r[0]}</td><td>{RAD_STAGE[r[1]]}</td><td>{RAD_FX[r[1]]}</td></tr>)}
        </tbody></table></div><p className="hint">У чистому місці минає 1 рад за пів години. Антирад виводить 250, горілка 100.</p></div>
        <div><h3>Лікування</h3><ul>
          <li>1 ОЗ відновлюється за 2 години, у спокої з доглядом за годину, у небезпеці за 4.</li>
          <li>Перша допомога: к10 + Медицина проти 5, 9, 13 або 17 за кількістю ран. У підсумку правил стоять 14 і 18, уточни в майстра.</li>
          <li>Бинт +2 проти кровотечі, аптечка +4, армійська й наукова +8.</li>
          <li>Зупинити кровотечу: Медицина проти 4, додаткова дія.</li>
        </ul></div>
        <div><h3>Побут</h3><ul>
          <li>День без їжі або води: −1 Тілобудова.</li>
          <li>Доба без сну: −1 до всього, крім Тілобудови. Друга: −1 Тілобудова і −2 до решти. На третю персонаж падає й спить.</li>
          <li>Пляшка горілки: −1 до Мудрості, Реакції, Сприйняття і Спритності, щогодини повертається по 1.</li>
        </ul></div>
      </div>
    </Box>
  );
}
