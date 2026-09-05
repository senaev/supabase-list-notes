import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { RxDatabase } from 'rxdb';
import { usePromise, UsePromiseResult } from 'senaev-utils/src/reactHooks/usePromise';

import { itemsSchema, LocalCollections, LocalCollectionsTypes, LocalDb } from '../sync/localDb';
import { createLocalDatabase } from '../sync/createLocalDatabase';

export type LocalDbContextType = UsePromiseResult<LocalDb<LocalCollectionsTypes>>;

const LocalDbContext = createContext<LocalDbContextType>(undefined);

LocalDbContext.displayName = 'LocalDbContext';

// Bump this suffix whenever the schema below changes shape without a
// version bump (see `version: 0` on itemsSchema) - RxDB refuses to open an
// existing local database whose stored schema doesn't match the current
// one, and this local database is a pure Supabase mirror, so it's always
// safe to just abandon the old one and start fresh under a new name rather
// than write a migration for what is effectively disposable cache data.
const DATABASE_NAME = 'supabase-list-notes-local-db-v4';

// TODO: move somewhere else
const localDbPromise: Promise<RxDatabase<LocalCollections>> = createLocalDatabase(DATABASE_NAME, {
    items: itemsSchema,
}).catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);

    throw error;
});

export function LocalDbContextProvider({ children }: PropsWithChildren) {
    const localDbPromiseResult = usePromise(localDbPromise);

    const localDbContextValue: LocalDbContextType = useMemo(() => {
        if (localDbPromiseResult === undefined) {
            return undefined;
        }

        if ('error' in localDbPromiseResult) {
            return { error: localDbPromiseResult.error };
        }

        return {
            data: new LocalDb(localDbPromiseResult.data),
        };
    }, [localDbPromiseResult]);

    return (
        <LocalDbContext.Provider value={localDbContextValue}>{children}</LocalDbContext.Provider>
    );
}

export const useLocalDb = (): LocalDbContextType => useContext(LocalDbContext);

export const useExistingLocalDb = (): LocalDb<LocalCollectionsTypes> => {
    const contextValue = useContext(LocalDbContext);

    if (contextValue === undefined) {
        throw new Error('LocalDbContext is not provided in useExistingLocalDbFacade');
    }

    if ('error' in contextValue) {
        throw new Error(`LocalDbContext error in useExistingLocalDbFacade: ${contextValue.error}`);
    }

    return contextValue.data;
};
