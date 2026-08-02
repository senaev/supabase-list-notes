import { createRxDatabase, RxCollection, RxConflictHandler, RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { ITEMS_TABLE_NAME } from '../const/ITEMS_TABLE_NAME';
import type { Item } from './types';

/**
 * RxDB's own representation of a document always carries a `_deleted` flag
 * (the tombstone used by the sync engine and by `find()`/`findOne()`, which
 * silently exclude `_deleted: true` docs), even though it's not part of the
 * JSON schema below. This matches how the `items` Postgres table itself
 * models deletion (see schema.sql).
 */
export type LocalItemRow = Item & {
    _deleted: boolean;
};

export type LocalCollections = {
    items: RxCollection<LocalItemRow>;
};

// Bump this suffix whenever the schema below changes shape without a
// version bump (see `version: 0` on itemsSchema) - RxDB refuses to open an
// existing local database whose stored schema doesn't match the current
// one, and this local database is a pure Supabase mirror, so it's always
// safe to just abandon the old one and start fresh under a new name rather
// than write a migration for what is effectively disposable cache data.
const DATABASE_NAME = 'supabase-list-notes-local-db-v3';

const itemsSchema = {
    title: `${ITEMS_TABLE_NAME} schema`,
    version: 0,
    type: 'object',
    primaryKey: 'id',
    additionalProperties: false,
    properties: {
        id: {
            type: 'string',
            maxLength: 128,
        },
        title: {
            type: 'string',
            maxLength: 10000,
        },
        type: {
            type: 'string',
            maxLength: 32,
        },
        checked_at: {
            type: ['string', 'null'],
            maxLength: 64,
        },
        created_at: {
            type: 'string',
            maxLength: 64,
        },
        _modified: {
            type: 'string',
            maxLength: 64,
        },
    },
    required: ['id', 'title', 'type', 'checked_at', 'created_at', '_modified'],
} as const;

function isNewer(a: { _modified: string }, b: { _modified: string }): boolean {
    return Date.parse(a._modified) > Date.parse(b._modified);
}

function isSameIgnoringModified(a: LocalItemRow, b: LocalItemRow): boolean {
    return (
        a.id === b.id &&
        a.title === b.title &&
        a.type === b.type &&
        a.checked_at === b.checked_at &&
        a.created_at === b.created_at &&
        a._deleted === b._deleted
    );
}

/**
 * RxDB passes this exact context string when checking whether a state
 * pulled/streamed from Supabase should be written down into the local
 * fork (see rxdb's replication-protocol/downstream.js). We use it to
 * suppress a stale echo - e.g. a slow round trip for an earlier keystroke -
 * that is older than an edit the user already made locally, so it can't
 * clobber that newer local edit before the fresher round trip lands.
 */
const DOWNSTREAM_EQUALITY_CHECK_CONTEXT = 'downstream-check-if-equal-1';

/**
 * `isEqual` is called with (incomingMasterState, currentForkState). Returning
 * true tells RxDB the two states are equivalent, so it skips overwriting the
 * local fork with the incoming state.
 */
const conflictHandler: RxConflictHandler<LocalItemRow> = {
    isEqual: (a, b, context) => {
        if (
            context === DOWNSTREAM_EQUALITY_CHECK_CONTEXT &&
            Date.parse(a._modified) < Date.parse(b._modified)
        ) {
            return true;
        }
        return isSameIgnoringModified(a, b);
    },
    resolve: ({ realMasterState, newDocumentState }) =>
        Promise.resolve(
            isNewer(realMasterState, newDocumentState) ? realMasterState : newDocumentState,
        ),
};

/**
 * Creates a fresh local database + `items` collection. Callers are
 * responsible for calling `.remove()` on the previous database (if any)
 * before creating a new one for a different Supabase project, so that one
 * project's items can never leak into another project's local storage or
 * get pushed to the wrong backend.
 */
export async function createLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    const database = await createRxDatabase<LocalCollections>({
        name: DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: true,
    });

    await database.addCollections({
        items: {
            schema: itemsSchema,
            conflictHandler,
        },
    });

    return database;
}
