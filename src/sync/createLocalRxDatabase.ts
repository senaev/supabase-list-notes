import {
    addRxPlugin,
    createRxDatabase,
    defaultConflictHandler,
    removeRxDatabase,
    RxCollection,
    RxCollectionCreator,
    RxConflictHandler,
    RxDatabase,
    RxJsonSchema,
    RxStorage,
} from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';

import { pickNewerRow, RxDbRowClock } from './pickNewerRow';

const rxDbDexieStorage = getRxStorageDexie();
const rxDbStorage: RxStorage<unknown, unknown> = import.meta.env.DEV
    ? wrappedValidateAjvStorage({ storage: rxDbDexieStorage })
    : rxDbDexieStorage;

if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
}

export type RowsDictionary = Record<string, RxDbRowClock>;

export type SchemasOf<Rows extends RowsDictionary> = {
    [Name in keyof Rows]: RxJsonSchema<Rows[Name]>;
};

export type CollectionsOf<Rows extends RowsDictionary> = {
    [Name in keyof Rows]: RxCollection<Rows[Name]>;
};

type CollectionCreatorsOf<Rows extends RowsDictionary> = {
    [Name in keyof Rows]: RxCollectionCreator<Rows[Name]>;
};

function createConflictHandler<Row extends RxDbRowClock>(): RxConflictHandler<Row> {
    return {
        isEqual: defaultConflictHandler.isEqual,
        resolve: ({ realMasterState, newDocumentState }) => {
            const newer = pickNewerRow(newDocumentState, realMasterState);

            return Promise.resolve(newer);
        },
    };
}

async function createLocalRxCollections<Rows extends RowsDictionary>(
    databaseName: string,
    schemas: SchemasOf<Rows>
): Promise<RxDatabase<CollectionsOf<Rows>>> {
    const database = await createRxDatabase<CollectionsOf<Rows>>({
        name: databaseName,
        storage: rxDbStorage,
        multiInstance: true,
    });

    const collectionCreators: CollectionCreatorsOf<Rows> = mapObjectValues(
        schemas,
        <Name extends keyof Rows>(schema: SchemasOf<Rows>[Name]) => {
            return {
                schema,
                conflictHandler: createConflictHandler<Rows[Name]>(),
            };
        }
    );

    await database.addCollections(collectionCreators);

    return database;
}

export async function createLocalRxDatabase<Rows extends RowsDictionary>(
    databaseName: string,
    schemas: SchemasOf<Rows>
): Promise<RxDatabase<CollectionsOf<Rows>>> {
    try {
        return await createLocalRxCollections(databaseName, schemas);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('createLocalDatabase failed, clearing local database and retrying', error);

        await removeRxDatabase(databaseName, rxDbStorage);

        return await createLocalRxCollections(databaseName, schemas);
    }
}
