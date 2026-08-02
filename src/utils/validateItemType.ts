import { ITEM_TYPE_MAX_LENGTH } from '../const/ITEM_TYPE_MAX_LENGTH';

/**
 * Validates a user-entered item type before it's persisted. Mirrors the
 * `check (char_length(type) <= 32)` constraint on public.items.type (see
 * schema.sql) so invalid input is rejected client-side, with a readable
 * error message, before it ever reaches the DB.
 *
 * Returns an error message if invalid, or `null` if `rawType` (after
 * trimming) is valid.
 */
export function validateItemType(rawType: string): string | null {
    const type = rawType.trim();

    if (type.length === 0) {
        return 'Type cannot be empty.';
    }

    if (type.length > ITEM_TYPE_MAX_LENGTH) {
        return `Type must be ${ITEM_TYPE_MAX_LENGTH} characters or fewer.`;
    }

    return null;
}
