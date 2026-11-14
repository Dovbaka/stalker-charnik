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

`http://localhost:5173/?demo` runs on an in-memory backend: no Google sign-in, nothing is saved, one other player's sheet is seeded. Use it to look at the UI and to test by hand.

## Layout

- `src/rules/` — the game's rules as pure TypeScript, no React or Firebase. `data.ts` holds the tables (attributes, skills, market, guns), `character.ts` computes everything from a sheet (`derive`, `shotCalc`, damage, gear, the creation draft), `codes.ts` makes backup codes. Every rule change gets a test in `character.test.ts`.
- `src/backend/` — `Backend` interface with two implementations: `firebase.ts` (production) and `memory.ts` (demo and tests).
- `src/state/campaign.ts` — the store outside React: sign-in, all sheets, my sheets being edited, debounced saves, private notes. Components read it with `useCampaign()`.
- `src/ui/` — screens. `bits.tsx` has the shared controls. `Sheet.tsx` is the frame, `sheet/*Tab.tsx` are its four tabs. Each box of the sheet gets a `SheetApi` (`c`, `d`, `ro`, `edit`, `up`).
- `src/styles.css` — all styling, as design tokens on `:root` with a dark variant. No UI library.
- `firestore.rules` — access rules, deployed with the site.

## Data

- `chars/{id}` = `{ owner, ownerName, by, updatedAt, char }`. Any signed-in user reads, only the owner writes. `char` is a `Character` (`src/rules/types.ts`); `migrate()` brings any stored shape up to date, so add new fields with defaults there instead of writing migrations.
- `users/{uid}/secrets/{charId}` = `{ text, updatedAt }`: private notes, owner only.
- A sheet is changed with `up(c => { ... })`, an immer recipe; the store saves 0.9 s after the last change.

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
- Done in that pass: luck (pool typed in the wizard, may stay 0; spend 1/3/5; +2 at dawn, +3 in safety, never above the pool; +1 per point and luck rerolls in the shot calculator).

## Roadmap (agreed with the owner, in this order)

1. Owner's feedback on the redesign, phone and PC, every tab.
2. GM role, set by a document in Firestore: sees and edits every sheet, private notes included. Saves have to merge by field first, so a GM edit and a player edit at the same moment do not overwrite each other.
3. Item catalogue filled by the GM (weapons, armour, consumables, ammunition), replacing the tables hard-coded in `data.ts`. Players see only the items the GM has opened and add them to their sheet themselves. Custom items typed on a sheet stay on that sheet and never enter the catalogue.
4. Artefacts: on hold until the owner has talked to the GM. Do not build artefact effects before that.
5. Later: simplified NPC sheets for the GM.
