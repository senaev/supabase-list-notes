import {
    addRxPlugin,
    createRxDatabase,
    removeRxDatabase,
    RxCollection,
    RxConflictHandler,
    RxDatabase,
    RxDocument,
    RxStorage,
} from 'rxdb';
import { Subscription } from 'rxjs';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

import { ITEMS_TABLE_NAME } from '../const/ITEMS_TABLE_NAME';
import { noop } from '../utils/noop';

import { pickNewerRow } from './pickNewerRow';
import type { Item } from './types';

const dexieStorage = getRxStorageDexie();
const storage: RxStorage<unknown, unknown> = import.meta.env.DEV
    ? wrappedValidateAjvStorage({ storage: dexieStorage })
    : dexieStorage;

if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

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
const DATABASE_NAME = 'supabase-list-notes-local-db-v4';

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
        modified_at: {
            type: 'string',
            maxLength: 64,
        },
        update_index: {
            type: 'number',
            minimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
            multipleOf: 1,
        },
    },
    required: ['id', 'title', 'type', 'checked_at', 'created_at', 'modified_at', 'update_index'],
} as const;

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
        if (context === DOWNSTREAM_EQUALITY_CHECK_CONTEXT && pickNewerRow(a, b) === b) {
            return true;
        }

        return isSameIgnoringModified(a, b);
    },
    resolve: ({ realMasterState, newDocumentState }) =>
        Promise.resolve(pickNewerRow(newDocumentState, realMasterState)),
};

/**
 * Creates a fresh local database + `items` collection. Callers are
 * responsible for calling `.remove()` on the previous database (if any)
 * before creating a new one for a different Supabase project, so that one
 * project's items can never leak into another project's local storage or
 * get pushed to the wrong backend.
 *
 * If opening/setting up the IndexedDB-backed database fails (e.g. it was
 * left in a corrupted or schema-incompatible state, say by a browser crash
 * mid-write), the failure would otherwise repeat on every page load. This
 * local database is a disposable Supabase mirror - the replication plugin
 * re-pulls everything from scratch once its checkpoint is gone - so it's
 * always safe to wipe it and try once more.
 */
export async function createLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    try {
        return await openLocalDatabase();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('createLocalDatabase failed, clearing local database and retrying', error);

        await removeRxDatabase(DATABASE_NAME, storage);

        return await openLocalDatabase();
    }
}

async function openLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    const database = await createRxDatabase<LocalCollections>({
        name: DATABASE_NAME,
        storage,
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

type LocalTable<T> = {
    bulkPut: (rows: T[]) => Promise<void>;
    get: (id: string) => Promise<T | undefined>;
    observeAll: (onChange: (rows: T[]) => void) => Promise<Subscription>;
    put: (row: T) => Promise<void>;
    toArray: () => Promise<T[]>;
};

function mapDocument<T>(document: RxDocument<T>): T {
    return document.toMutableJSON();
}

export class LocalDbFacade {
    public readonly notes_temp = this.createTable((database) => database.items);

    public constructor(private readonly database: RxDatabase<LocalCollections>) {}

    public getCollections(): LocalCollections {
        return this.database.collections;
    }

    private createTable<T>(
        getCollection: (database: RxDatabase<LocalCollections>) => RxCollection<T>
    ): LocalTable<T> {
        return {
            bulkPut: async (rows): Promise<void> => {
                if (rows.length === 0) {
                    return;
                }

                await getCollection(this.database).bulkUpsert(rows);
            },

            get: async (id): Promise<T | undefined> => {
                const document = await getCollection(this.database).findOne(id).exec();

                if (!document) {
                    return undefined;
                }

                return mapDocument(document);
            },

            observeAll: async (onChange): Promise<Subscription> => {
                const query = getCollection(this.database).find();
                const initialDocuments = await query.exec();

                onChange(initialDocuments.map((document) => mapDocument(document)));

                return query.$.subscribe((documents) => {
                    onChange(documents.map((document) => mapDocument(document)));
                });
            },

            put: (row): Promise<void> =>
                getCollection(this.database).incrementalUpsert(row).then(noop),

            toArray: async (): Promise<T[]> => {
                const documents = await getCollection(this.database).find().exec();

                return documents.map((document) => mapDocument(document));
            },
        };
    }
}
