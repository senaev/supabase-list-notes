import {
    addRxPlugin,
    createRxDatabase,
    defaultConflictHandler,
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

const rxDbDexieStorage = getRxStorageDexie();
const rxDbStorage: RxStorage<unknown, unknown> = import.meta.env.DEV
    ? wrappedValidateAjvStorage({ storage: rxDbDexieStorage })
    : rxDbDexieStorage;

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

const conflictHandler: RxConflictHandler<LocalItemRow> = {
    isEqual: defaultConflictHandler.isEqual,
    resolve: ({ realMasterState, newDocumentState }) =>
        Promise.resolve(pickNewerRow(newDocumentState, realMasterState)),
};

export async function createLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    try {
        return await openLocalDatabase();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('createLocalDatabase failed, clearing local database and retrying', error);

        await removeRxDatabase(DATABASE_NAME, rxDbStorage);

        return await openLocalDatabase();
    }
}

async function openLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    const database = await createRxDatabase<LocalCollections>({
        name: DATABASE_NAME,
        storage: rxDbStorage,
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

    /**
     * Wipes this local mirror's storage (e.g. on logout), so the next
     * login - potentially to a different Supabase project - can't show a
     * stale mix of the previous account's items. This RxDatabase instance
     * is unusable afterwards.
     */
    public remove(): Promise<string[]> {
        return this.database.remove();
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
        };
    }
}
