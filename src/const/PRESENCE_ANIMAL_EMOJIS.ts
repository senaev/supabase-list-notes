/**
 * Fixed pool of "someone is editing this" avatars, in the spirit of Google
 * Docs' anonymous animals. One is picked at random per browser and then
 * persisted (see getUserEmoji), so the same person keeps the same animal
 * across reloads and across tabs.
 *
 * Ten is deliberately few: it keeps every animal instantly distinguishable
 * at pill size, and this app has no auth (see schema.sql), so there's no
 * real identity to derive an avatar from anyway. Two different people can
 * therefore end up with the same animal - the emoji is a hint about
 * concurrent editing, not an identity.
 *
 * Typed as `string[]` rather than a `as const` tuple so `includes()` can be
 * called with an arbitrary string read back from localStorage.
 */
export const PRESENCE_ANIMAL_EMOJIS: string[] = [
  "🐻",
  "🦊",
  "🦉",
  "🐙",
  "🐢",
  "🦁",
  "🐼",
  "🦈",
  "🐺",
  "🦅",
];
