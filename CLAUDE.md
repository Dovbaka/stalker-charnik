# Чарнік сталкера

An electronic character sheet for a friend's homebrew S.T.A.L.K.E.R. tabletop RPG (d10 system, one campaign, about five people). The aim is what D&D Beyond or Pathbuilder give their systems: players track a character by tapping buttons and the sheet applies the rules for them.

- Live site: https://stalker-rpg-builder.web.app (Firebase Hosting site `stalker-rpg-builder` in project `stalker-rpg-101a6`). The project's default address, stalker-rpg-101a6.web.app, only redirects there (`hosting-redirect/`).
- Rules source (the GM's document, Ukrainian): https://docs.google.com/document/d/19YPQULpNjHAonbOkKxUPkQemvipYKiMsMmTWzLBPyRo/edit — readable without login with `curl -sL ".../export?format=txt"`

## Commands

```bash
npm run dev          # local server on http://localhost:5173
npm test             # vitest: rules and the campaign store
npm run build        # type-check and build into dist/
npm run deploy       # build, then publish the site and firestore.rules (needs `npx firebase login` once)
```

`http://localhost:5173/?demo` runs on an in-memory backend: no Google sign-in, nothing is saved, one other player's sheet is seeded. Use it to look at the UI and to test by hand. `?demo&gm` signs in as the GM.

## Layout

- `src/rules/` — the game's rules as pure TypeScript, no React or Firebase. `data.ts` holds the tables (attributes, skills, market, guns), `catalog.ts` the GM's catalogue built on them, `character.ts` computes everything from a sheet (`derive`, `shotCalc`, damage, gear, the creation draft), `codes.ts` makes backup codes. Every rule change gets a test in `character.test.ts`.
- `src/backend/` — `Backend` interface with two implementations: `firebase.ts` (production) and `memory.ts` (demo and tests).
- `src/roles.ts` — the GM's Firebase Auth user id and the sheet fields the GM may change. `firestore.rules` repeats both lists; change them together. The GM is named by user id, never by e-mail, because the repository is public.
- `src/router.ts` — addresses on the History API, no library: `/` roster, `/new` wizard, `/gm` the GM's menu, `/c/{id}` a sheet on Картка, `/c/{id}/combat|pack|notes` the other tabs. Opening a screen pushes an address; switching tabs and leaving the wizard replace it, so Back goes from a sheet to the roster. The query string is kept, so `?demo` survives navigation.
- `src/state/campaign.ts` — the store outside React: sign-in, all sheets, the sheets I may change, debounced saves by field, private notes, the catalogue. Components read it with `useCampaign()`.
- `src/ui/` — screens. `bits.tsx` has the shared controls. `Sheet.tsx` is the frame, `sheet/*Tab.tsx` are its four tabs. Each box of the sheet gets a `SheetApi` (`c`, `d`, `ro`, `gm`, `edit`, `up`). `Gm.tsx` is the GM's menu with the catalogue editor.
- `src/styles.css` — all styling, as design tokens on `:root` with a dark variant. No UI library.
- `firestore.rules` — access rules, deployed with the site.

## Data

- `chars/{id}` = `{ owner, ownerName, by, updatedAt, char }`. Any signed-in user reads; the owner writes; the GM may change only the fields in `GM_FIELDS` (health, radiation, conditions, coupons and gear) on another player's sheet. `char` is a `Character` (`src/rules/types.ts`); `migrate()` brings any stored shape up to date, so add new fields with defaults there instead of writing migrations.
- `users/{uid}/secrets/{charId}` = `{ text, updatedAt }`: private notes, owner only.
- `catalog/main` = `{ guns, items, armors, updatedAt }`: the GM's catalogue. Everyone reads, only the GM writes. Until the GM first saves it, `DEFAULT_CATALOG` (the tables in `data.ts`, ids `g-N`, `m-N`) stands in. Entries the GM hides (`hidden`) are not offered to players. Taking an entry copies it into the sheet, so catalogue edits never reach sheets and sheet edits never reach the catalogue. Prices of 0 keep an entry out of the creation shop.
- A sheet is changed with `up(c => { ... })`, an immer recipe; the store saves 0.9 s after the last change and writes only the top-level fields that differ from the server's copy (`patchChar`, `char.<field>` in Firestore). News from the server replaces every field except the ones changed here and not saved yet, so a GM edit and a player edit at the same time both survive unless they touch the same field. A new sheet is written whole once (`saveChar`).
- `up` returns an undo function for that one change; `toast(text, undo)` shows «Скасувати» for 4.5 s. Damage, healing, spending luck, resting, coupons, using, buying, adding and discarding things offer it; small steppers do not.

## Conventions

- All interface text is Ukrainian, plain and gender-neutral (the sheet serves any character): «Отримати шкоду», not «Отримала».
- The rules belong to the GM. Where the document is silent or contradicts itself, say so in the UI and leave the decision to the GM; do not invent a ruling.
- Players know little S.T.A.L.K.E.R. lore on purpose: no canon factions or names in the interface.
- Keep it simple: one campaign, a handful of users. No abstractions for scale that is not there.

## Design rules (from the owner, 2026-11-14)

- One fixed theme for everyone. The look must not follow the operating system's light or dark setting.
- Clean at a glance: numbers and marks instead of sentences. Wound thresholds are ticks on the health bar, not a line of text. No asides like "weight 3 kg, not counted in the load".
- No roll formulas next to skills or attributes (no "к10 + 6 зі Спритністю"): the GM says what is added.
- Tabs and what they are for: **Картка** is the general view, open most of the time; **Бій** is for combat; **Рюкзак** is for items; **Нотатки** holds notes and every rules reminder.
- On Картка: no "Особова справа" box (name and role sit in the header, looks and backstory move to Нотатки) and no "Кидки й рух" box (only the movement speed stays).
- Style: «Бланк», the dark olive field form (variant А of the mockups at https://claude.ai/artifact/Sfd3NzpT8i5HjGEVK8YSpK), chosen 2026-11-14 with these changes: only the callsign in the header (no role); skill levels as dots, not squares; the health number and bar change colour at each wound threshold (green, yellow, orange, red); the condition is called «Алкоголь», not «Горілка», because beer and the rest exist too.
- No virtual dice: everyone rolls at the table. The shot calculator only says what the die must show (owner, 2026-11-14).
- Nothing may appear, disappear or change height when a number changes: reserve the space (show a control disabled, hide text with `visibility`). Height may change only when the person adds or opens something.
- Health is changed by any amount on every tab: a field (empty means 1) with − and +. In combat − goes through the chosen armour.
- Multi-shot fire follows the rules document: semi-automatic 2 shots without penalty, burst of three −1 on the 2nd and 3rd, automatic −1, −2, −3, −4 on shots 2–5. The owner remembered "−1 more for every shot" for all multi-shot weapons; if the GM confirms that, change `FIRE_MODES` in `rules/character.ts`.
- Luck, health, sleep, food, water, radiation and alcohol come back through one «Відпочити» window in the header (`rules/rest.ts`): it asks the conditions, shows what will change, applies on confirm. No separate dawn buttons.
- «Рюкзак» holds everything owned: weapons with an «На собі» flag (any number), armours with «Надіта» (one at a time). «Бій» shows only what is on the body.
- Weapon attachments (`Weapon.mods`): a scope or collimator carries the rules' +1 and is offered in the calculator only for a weapon that has it; "other" attachments carry a GM-set bonus and show only when it is not 0.
- The GM's earlier rules document (a PDF the owner sent on 2026-11-14, not in the repo) supplied the extra catalogue: pistols, rifles, shotguns, heavy weapons, the bayonet, ammunition for new calibres, explosives, and the weapon features (`MOD_INFO` in `rules/data.ts`). Where it disagrees with the current Google document, the current one wins: scopes +1 at 50 m and further (the earlier said 200 m), current prices. Weapons only the earlier document has carry price 0 and stay out of the creation shop. NATO flags of those weapons are set by origin, because the earlier document marks NATO by colour.
- Crawling is half the move, rounded up (owner, 2026-11-14).
- No hint in the sheet speaks to the player ("уточни в майстра", "впиши…"): plain statements only.
- Tabs lay out in three fixed columns (`.cols` > `.col`), so opening a panel never moves boxes between columns.
- The site is called «S.T.A.L.K.E.R. TTRPG» (tab title, sign-in page, roster header), not «Чарнік сталкера» (owner, 2026-11-14).
- The sign-in page is variant Б «Периметр» of the mockups (same canvas, second row) in variant А's colours: hazard tape in the line colour at the top and bottom, the amber trefoil, the name, one olive button, nothing else. Advice about Telegram and other in-app browsers appears only in the error after a failed sign-in.
- The tab icon is the dark trefoil on an amber square: `public/favicon.svg`, and `public/apple-touch-icon.png` is the same at 180 px without rounded corners for iPhones. Redraw the PNG whenever the SVG changes.
- Attribute tiles on Картка show the full names in normal case without letter spacing (`.attr .lbl`), because capitals with spacing do not fit five tiles on a phone. «Сприйняття» keeps the GM's name. On 2026-11-14 the owner tried «Уважність» with one-letter tiles, then went back to the full names.
- Weapons, armour and items each have a «Змінити» button outside «Редагувати». It opens that thing's fields and «Викинути». A new armour or an own weapon opens its fields at once. «Редагувати» (called «Правити» before 2026-11-14) is for the character's build (attributes, skills, abilities), not for gear.
- Roster: deleting a character is a «Видалити» button that asks «Точно видалити?», not a ×. The private notes box says «приховано від інших». Радіація, Удача and Швидкість (called Хід before) carry small icons: the trefoil, a clover, boot prints; on phones narrower than 360 px the icons hide so the word fits. The header buttons Персонажі, Відпочити and Редагувати carry line icons too. Every icon is in the text colour, never coloured (owner, 2026-11-14).
- Алкоголь turns amber only while the character is drinking and one more portion would knock them out. A sober character with Мудрість 1 is not highlighted; the tooltip still says the first portion knocks them out.
- The GM (owner, 2026-11-14): sees every sheet and opens any of them; on another player's sheet health, radiation, conditions, coupons and the whole backpack are editable, the rest is read-only, private notes stay hidden, and only the owner can delete a character. The GM's menu (roster → «Меню майстра», `/gm`) edits the catalogue: change, add, hide, delete entries, or put the standard catalogue back. An artefact catalogue comes later.
- Health green is muted (`--l0` #709654): the earlier bright green was too harsh on the bar.
- After sign-in the home page is the roster, not the last sheet (owner, 2026-11-14). A reload or a shared link opens the sheet and tab in the address; a sheet that is not in the base sends the person back to the roster.
- A counter (`Stepper`) keeps its frame even: its buttons are the frame of the number, so a disabled − or + dims only its sign, not its border.
- Health box (variant Б of the 2026-11-14 mockups): an amount field with «Шкода» and «Лікувати» buttons in muted red and olive fills, no bright outlines; the bleeding row is «Кровотеча», a «Раунд −1» button as tall as its counter, and the counter. Damage types start with a capital letter. Every bar (`Meter`: health, radiation, load) is a thin 8 px bar on a dark track, its marks gaps in the bar.
- Done in that pass: luck (pool typed in the wizard, may stay 0; spend 1/3/5; +2 at dawn, +3 in safety, never above the pool; +1 per point and luck rerolls in the shot calculator).

## Roadmap (agreed with the owner, in this order)

1. Owner's feedback on the redesign, phone and PC, every tab.
2. Done 2026-11-14: GM role (by user id in `roles.ts` and `firestore.rules`, health and gear only, private notes stay private), saves by field, the GM's item catalogue (weapons, armour, items and ammunition). Next for the GM: an artefact catalogue, once the artefact rules are known.
3. Artefacts: on hold until the owner has talked to the GM. Do not build artefact effects before that.
4. Later: simplified NPC sheets for the GM.
