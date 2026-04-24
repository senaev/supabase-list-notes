import {
    createRxDatabase, RxCollection, RxDatabase, RxDocument,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { Subscription } from 'rxjs';
import { noop } from 'senaev-utils/src/utils/Function/noop';

export type LocalNoteRow = {
    id: string;
    title: string;
    created_at: string;
    _modified: string;
};

export type LocalNoteItemRow = {
    id: string;
    note_id: string;
    is_child: boolean;
    title: string;
    position: number;
    created_at: string;
    _modified: string;
    completed_at: string | null;
};

type LocalMetaRow = {
    key: string;
    value: string;
};

export type LocalCollections = {
    notes_temp: RxCollection<LocalNoteRow>;
    note_items_temp: RxCollection<LocalNoteItemRow>;
    meta: RxCollection<LocalMetaRow>;
};

type LocalTable<T> = {
    bulkPut: (rows: T[]) => Promise<void>;
    get: (id: string) => Promise<T | undefined>;
    observeAll: (onChange: (rows: T[]) => void) => Promise<Subscription>;
    put: (row: T) => Promise<void>;
    remove: (id: string) => Promise<void>;
    toArray: () => Promise<T[]>;
};

const DATABASE_NAME = 'supabase-list-notes-local-db-v2';

const noteSchema = {
    title: 'notes_temp schema',
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
        created_at: {
            type: 'string',
            maxLength: 64,
        },
        _modified: {
            type: 'string',
            maxLength: 64,
        },
    },
    required: [
        'id',
        'title',
        'created_at',
        '_modified',
    ],
} as const;

const noteItemSchema = {
    title: 'note_items_temp schema',
    version: 0,
    type: 'object',
    primaryKey: 'id',
    additionalProperties: false,
    properties: {
        id: {
            type: 'string',
            maxLength: 128,
        },
        note_id: {
            type: 'string',
            maxLength: 128,
        },
        is_child: {
            type: 'boolean',
        },
        title: {
            type: 'string',
            maxLength: 10000,
        },
        position: {
            type: 'number',
            minimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
            multipleOf: 1,
        },
        created_at: {
            type: 'string',
            maxLength: 64,
        },
        _modified: {
            type: 'string',
            maxLength: 64,
        },
        completed_at: {
            type: [
                'string',
                'null',
            ],
            maxLength: 64,
        },
    },
    required: [
        'id',
        'note_id',
        'is_child',
        'title',
        'position',
        'created_at',
        '_modified',
        'completed_at',
    ],
} as const;

const metaSchema = {
    title: 'local meta schema',
    version: 0,
    type: 'object',
    primaryKey: 'key',
    additionalProperties: false,
    properties: {
        key: {
            type: 'string',
            maxLength: 128,
        },
        value: {
            type: 'string',
            maxLength: 128,
        },
    },
    required: [
        'key',
        'value',
    ],
} as const;

export async function createLocalDatabase(): Promise<RxDatabase<LocalCollections>> {
    const database = await createRxDatabase<LocalCollections>({
        name: DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: true,
    });

    await database.addCollections({
        notes_temp: {
            schema: noteSchema,
        },
        note_items_temp: {
            schema: noteItemSchema,
        },
        meta: {
            schema: metaSchema,
        },
    });

    return database;
}

function mapDocument<T>(document: RxDocument<T>): T {
    return document.toMutableJSON();
}

export class LocalDbFacade {
    public readonly notes_temp = this.createTable((database) => database.notes_temp);
    public readonly note_items_temp = this.createTable((database) => database.note_items_temp);
    public readonly meta = this.createTable((database) => database.meta);

    public constructor(private readonly database: RxDatabase<LocalCollections>) {
    }

    public getCollections(): LocalCollections {
        return this.database.collections;
    }

    private createTable<T>(getCollection: (database: RxDatabase<LocalCollections>) => RxCollection<T>): LocalTable<T> {
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

            put: (row): Promise<void> => getCollection(this.database).incrementalUpsert(row).then(noop),

            remove: async (id): Promise<void> => {
                const document = await getCollection(this.database).findOne(id).exec();

                if (!document) {
                    return;
                }

                await document.incrementalRemove();
            },

            toArray: async (): Promise<T[]> => {
                const documents = await getCollection(this.database).find().exec();

                return documents.map((document) => mapDocument(document));
            },
        };
    }
}
