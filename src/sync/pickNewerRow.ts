export type RowClock = {
    update_index: number;
    modified_at: string;
};

/**
 * `update_index` is a Postgres-enforced revision counter (see schema.sql's
 * handle_items_timestamps trigger: `new.update_index = old.update_index + 1`,
 * ignoring whatever the client sends) - it only ever moves forward by
 * exactly 1 per confirmed write, so it can't be thrown off by a client's
 * clock being wrong the way `modified_at` can. `modified_at` is only a
 * tiebreaker for the rare case where two rows carry the same update_index
 * (e.g. comparing a not-yet-confirmed local edit against itself before any
 * write has happened).
 *
 * Returns `candidate` only if it is strictly newer than `current`;
 * otherwise returns `current`. Ties (both fields equal) keep `current`.
 */
export function pickNewerRow<T extends RowClock>(current: T, candidate: T): T {
    if (candidate.update_index !== current.update_index) {
        return candidate.update_index > current.update_index ? candidate : current;
    }

    return Date.parse(candidate.modified_at) > Date.parse(current.modified_at)
        ? candidate
        : current;
}
