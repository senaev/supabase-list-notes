import { RxCollection, RxDatabase, RxDocument, RxJsonSchema } from 'rxdb';
import { Subject } from 'rxjs';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

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
    readonly items: Signal<T[]>;
    readonly put: (row: T) => Promise<void>;
    readonly onSubscribeError: Subject<Error>;
};

function mapDocuments<T>(documents: RxDocument<T>[]): T[] {
    return documents.map((document) => document.toMutableJSON());
}

function createTable<T extends Record<string, unknown>>(
    collection: RxCollection<T>
): LocalTable<T> {
    const onSubscribeError = new Subject<Error>();
    const items = new Signal<T[]>([]);

    const query = collection.find();

    query
        .exec()
        .then((initialDocuments) => {
            const initialState = mapDocuments(initialDocuments);

            items.dispatch(initialState);

            const subscription = query.$.subscribe((nextDocuments) => {
                const nextState = mapDocuments(nextDocuments);

                items.dispatch(nextState);
            });

            // TODO: implement subscription teardown
            noop(subscription);
        })
        .catch((error) => {
            onSubscribeError.next(error);
        });

    return {
        items,
        onSubscribeError,
        put: (row): Promise<void> => {
            const promise = collection.incrementalUpsert(row).then(noop);

            // TODO: handle error
            return promise;
        },
    };
}

export class LocalDb<T extends Record<string, Record<string, unknown>>> {
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
