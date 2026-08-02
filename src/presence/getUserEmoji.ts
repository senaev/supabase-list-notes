import { PRESENCE_ANIMAL_EMOJIS } from '../const/PRESENCE_ANIMAL_EMOJIS';

const LOCAL_STORAGE_KEY = 'presence-user-emoji';

/**
 * The current browser's animal avatar, assigned once at random and then
 * persisted to localStorage so it survives reloads and is shared by every
 * tab of the same browser (the point being that "the same person" looks the
 * same everywhere, even when they have the list open several times).
 *
 * A stored value that isn't in PRESENCE_ANIMAL_EMOJIS anymore (e.g. the
 * pool was edited between releases) is discarded and re-rolled rather than
 * shown as-is, so the pool stays the single source of truth for which
 * avatars can appear.
 */
export function getUserEmoji(): string {
    const storedEmoji = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (storedEmoji && PRESENCE_ANIMAL_EMOJIS.includes(storedEmoji)) {
        return storedEmoji;
    }

    const emoji = PRESENCE_ANIMAL_EMOJIS[Math.floor(Math.random() * PRESENCE_ANIMAL_EMOJIS.length)];

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, emoji);
    } catch (error) {
        // Storage can be unavailable (Safari private mode, quota). Presence
        // still works this session; the avatar just won't be stable across
        // reloads, which is strictly better than failing to render the list.
        // eslint-disable-next-line no-console -- surface storage failures in devtools
        console.error('Failed to persist the presence emoji:', error);
    }

    return emoji;
}
