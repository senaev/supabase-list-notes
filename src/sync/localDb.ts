import { RxCollection, RxDatabase, RxDocument, RxJsonSchema } from 'rxdb';
import { Subscription } from 'rxjs';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';

import { ITEMS_TABLE_NAME } from '../const/ITEMS_TABLE_NAME';
import { noop } from '../utils/noop';

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

export type LocalCollectionsTypes = {
    items: LocalItemRow;
};

export type LocalCollectionsTypeWrapper<T extends Record<string, Record<string, unknown>>> = {
    [key in keyof T]: RxCollection<T[key]>;
};

export type LocalCollections = LocalCollectionsTypeWrapper<LocalCollectionsTypes>;

export const itemsSchema: RxJsonSchema<LocalItemRow> = {
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
        _deleted: {
            type: 'boolean',
        },
    },
    required: ['id', 'title', 'type', 'checked_at', 'created_at', 'modified_at', 'update_index'],
};

type LocalTable<T> = {
    bulkPut: (rows: T[]) => Promise<void>;
    get: (id: string) => Promise<T | undefined>;
    observeAll: (onChange: (rows: T[]) => void) => Promise<Subscription>;
    put: (row: T) => Promise<void>;
};

function mapDocument<T>(document: RxDocument<T>): T {
    return document.toMutableJSON();
}

function createTable<T extends Record<string, unknown>>(
    collection: RxCollection<T>
): LocalTable<T> {
    return {
        bulkPut: async (rows): Promise<void> => {
            if (rows.length === 0) {
                return;
            }

            await collection.bulkUpsert(rows);
        },

        get: async (id): Promise<T | undefined> => {
            const document = await collection.findOne(id).exec();

            if (!document) {
                return undefined;
            }

            return mapDocument(document);
        },

        observeAll: async (onChange): Promise<Subscription> => {
            const query = collection.find();
            const initialDocuments = await query.exec();

            onChange(initialDocuments.map((document) => mapDocument(document)));

            return query.$.subscribe((documents) => {
                onChange(documents.map((document) => mapDocument(document)));
            });
        },

        put: (row): Promise<void> => collection.incrementalUpsert(row).then(noop),
    };
}

export class LocalDbFacade<T extends Record<string, Record<string, unknown>>> {
    public readonly tables: {
        [key in keyof T]: LocalTable<T[key]>;
    };

    public constructor(private readonly database: RxDatabase<LocalCollectionsTypeWrapper<T>>) {
        this.tables = mapObjectValues(database.collections, (collection) => {
            const localTable = createTable(collection);

            return localTable;
        });
    }

    public getCollections(): LocalCollectionsTypeWrapper<T> {
        return this.database.collections;
    }

    public remove(): Promise<string[]> {
        return this.database.remove();
    }
}
