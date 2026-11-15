// The frame of every GM screen: the title, the save state, the way back to the roster, and the three sections.
import type { ReactNode } from "react";
import { navigate, type Route } from "../../router";
import type { Sync } from "../../state/campaign";
import { cx } from "../../util";
import { Btn, IconPeople } from "../bits";

const SECTIONS: [Route["name"], string][] = [["gm", "Каталог"], ["npcs", "NPC"], ["encs", "Енкаунтери"]];

export function GmFrame({ sec, sub, sync, children }: { sec: "gm" | "npcs" | "encs"; sub: string; sync: Sync; children: ReactNode }) {
  const status = sync === "err" ? "Не збережено" : sync === "saving" ? "Зберігаю" : "";
  return (
    <div className="sc-gm">
      <header className="top">
        <div className="who"><h1>Меню майстра</h1><div className="sub">{sub}</div></div>
        <div className="top-r">
          <span className={cx("sync", sync === "err" && "s-err", sync === "saving" && "s-saving")} style={{ visibility: status ? "visible" : "hidden" }}>{status || "·"}</span>
          <Btn sm className="ib" onClick={() => navigate({ name: "roster" })}><IconPeople />Персонажі</Btn>
        </div>
      </header>
      <nav className="tabs gmsec" aria-label="Розділи меню майстра">
        {SECTIONS.map(([name, label]) => (
          <button type="button" key={name} className={cx("tab", sec === name && "on")} aria-current={sec === name ? "page" : undefined}
            onClick={() => navigate({ name } as Route)}>{label}</button>
        ))}
      </nav>
      {children}
    </div>
  );
}
