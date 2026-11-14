# Чарнік сталкера

An electronic character sheet for a friend's homebrew S.T.A.L.K.E.R. tabletop RPG (d10 system, one campaign, about five people). The aim is what D&D Beyond or Pathbuilder give their systems: players track a character by tapping buttons and the sheet applies the rules for them.

- Live site: https://stalker-rpg-101a6.web.app (Firebase Hosting, project `stalker-rpg-101a6`)
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

## Roadmap (agreed with the owner, in this order)

1. Luck: a pool of 5 + 1d4 rolled once; spend 1 for ±1 on a check, 3 for a reroll, 5 for automatic success or the enemy's failure; +2 back at dawn, +1 more after 12 hours in a safe zone.
2. GM role, set by a document in Firestore: sees and edits every sheet, private notes included.
3. Item database filled by the GM (weapons, artefacts, consumables) that replaces the tables hard-coded in `data.ts`.
4. Later: simplified NPC sheets for the GM.
