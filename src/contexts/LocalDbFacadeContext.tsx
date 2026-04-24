import {
    createContext,
    PropsWithChildren,
    useContext,
    useRef,
} from 'react';
import { RxDatabase } from 'rxdb';
import { usePromise, UsePromiseResult } from 'senaev-utils/src/reactHooks/usePromise';

import {
    createLocalDatabase, LocalCollections, LocalDbFacade,
} from '../localDb/LocalDbFacade';

export type LocalDbFacadeContextType = UsePromiseResult<LocalDbFacade>;

const LocalDbFacadeContext = createContext<LocalDbFacadeContextType>(undefined);

LocalDbFacadeContext.displayName = 'LocalDbFacadeContext';

// TODO: move somewhere else
const localDbPromise: Promise<RxDatabase<LocalCollections>> = createLocalDatabase();

export function LocalDbFacadeContextProvider({ children }: PropsWithChildren) {
    const localDbPromiseResult = usePromise(localDbPromise);

    const localDbFacadeRef = useRef<{
        promise: Promise<RxDatabase<LocalCollections>>;
        localDbFacade: LocalDbFacade;
    } | undefined>(undefined);

    let localDbFacadeContextValue: LocalDbFacadeContextType;

    if (localDbPromiseResult === undefined) {
        localDbFacadeContextValue = undefined;
    } else if ('error' in localDbPromiseResult) {
        localDbFacadeContextValue = { error: localDbPromiseResult.error };
    } else {
        if (localDbFacadeRef.current === undefined || localDbFacadeRef.current.promise !== localDbPromise) {
            const localDbFacade = new LocalDbFacade(localDbPromiseResult.data);

            localDbFacadeRef.current = {
                promise: localDbPromise,
                localDbFacade,
            };
        }

        localDbFacadeContextValue = { data: localDbFacadeRef.current.localDbFacade };
    }

    return <LocalDbFacadeContext.Provider value={localDbFacadeContextValue}>
        {children}
    </LocalDbFacadeContext.Provider>;
}

export const useLocalDbFacade = (): LocalDbFacadeContextType => useContext(LocalDbFacadeContext);

export const useExistingLocalDbFacade = (): LocalDbFacade => {
    const contextValue = useContext(LocalDbFacadeContext);

    if (contextValue === undefined) {
        throw new Error('LocalDbFacadeContext is not provided in useExistingLocalDbFacade');
    }

    if ('error' in contextValue) {
        throw new Error(`LocalDbFacadeContext error in useExistingLocalDbFacade: ${contextValue.error}`);
    }

    return contextValue.data;
};
