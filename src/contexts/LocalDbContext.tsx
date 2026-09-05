import { createContext, PropsWithChildren, useContext } from 'react';
import { usePromise, UsePromiseResult } from 'senaev-utils/src/reactHooks/usePromise';
import { mapObjectValues } from 'senaev-utils/src/utils/Object/mapObjectValues/mapObjectValues';

import { itemsSchema, LocalCollectionsTypes, LocalDb, LocalItemRow } from '../sync/localDb';
import { createLocalRxDatabase } from '../sync/createLocalRxDatabase';
import {
    OptimisticSyncTable,
    OptimisticSyncTablesDict,
} from '../sync/OptimisticSyncTable/OptimisticSyncTable';

export type LocalDbContextType = {
    localDb: LocalDb<LocalCollectionsTypes>;
    syncTables: OptimisticSyncTablesDict<LocalCollectionsTypes>;
};

const LocalDbContext = createContext<UsePromiseResult<LocalDbContextType>>(undefined);

LocalDbContext.displayName = 'LocalDbContext';

// Bump this suffix whenever the schema below changes shape without a
// version bump (see `version: 0` on itemsSchema) - RxDB refuses to open an
// existing local database whose stored schema doesn't match the current
// one, and this local database is a pure Supabase mirror, so it's always
// safe to just abandon the old one and start fresh under a new name rather
// than write a migration for what is effectively disposable cache data.
const DATABASE_NAME = 'supabase-list-notes-local-db-v4';

// TODO: move somewhere else
const localRxDatabasePromise: Promise<LocalDbContextType> = createLocalRxDatabase(DATABASE_NAME, {
    items: itemsSchema,
})
    .then((localRxDatabase) => {
        const localDb = new LocalDb(localRxDatabase);

        const syncTables: OptimisticSyncTablesDict<LocalCollectionsTypes> = mapObjectValues(
            localDb.tables,
            (table) => new OptimisticSyncTable<LocalItemRow>(table)
        );

        return {
            localDb,
            syncTables,
        };
    })
    .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);

        throw error;
    });

export function LocalDbContextProvider({ children }: PropsWithChildren) {
    const localDbContextValue = usePromise(localRxDatabasePromise);

    return (
        <LocalDbContext.Provider value={localDbContextValue}>{children}</LocalDbContext.Provider>
    );
}

export const useLocalDb = (): UsePromiseResult<LocalDbContextType> => useContext(LocalDbContext);

export const useExistingLocalDb = (): LocalDbContextType => {
    const contextValue = useContext(LocalDbContext);

    if (contextValue === undefined) {
        throw new Error('LocalDbContext is not provided in useExistingLocalDbFacade');
    }

    if ('error' in contextValue) {
        throw new Error(`LocalDbContext error in useExistingLocalDbFacade: ${contextValue.error}`);
    }

    return contextValue.data;
};
