// Who the GM is, and which parts of another player's sheet the GM may change.
// firestore.rules repeats both lists, because the rules cannot import code: change them together.
// The GM is named by Firebase Auth user id, not by e-mail, because this repository is public.

export const GM_UIDS: readonly string[] = ["NS1EKdmeqNeSAYJ6NsNeTiRL1YI3"];

/** Health, radiation, the body's conditions and everything carried. Skills, attributes, luck and notes stay the player's. */
export const GM_FIELDS: readonly string[] = [
  "hp", "woundsTreated", "bleed", "rad",
  "vodka", "noSleep", "noFood", "noWater",
  "money", "armors", "mask", "weapons", "items", "artifacts",
  "updatedAt",
];
