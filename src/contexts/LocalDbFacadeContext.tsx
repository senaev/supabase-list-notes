import {
    createContext,
    PropsWithChildren,
    useContext,
} from 'react';
import { usePromise } from 'senaev-utils/src/reactHooks/usePromise';

import { LocalDbFacade } from '../localDb/LocalDbFacade';

const LocalDbFacadeContext = createContext<LocalDbFacade | undefined>(undefined);

LocalDbFacadeContext.displayName = 'LocalDbFacadeContext';

export function LocalDbFacadeContextProvider({ children, localDbFacade }: PropsWithChildren & {
    localDbFacade: LocalDbFacade;
}) {
    return <LocalDbFacadeContext.Provider value={localDbFacade}>
        {children}
    </LocalDbFacadeContext.Provider>;
}

export const useLocalDbFacade = (): LocalDbFacade => {
    const localDbFacade = useContext(LocalDbFacadeContext);

    if (!localDbFacade) {
        throw new Error('useSupabaseControllerStatus must be used within a SupabaseClientContextProvider');
    }

    return localDbFacade;
};

export type LocalDbFacadeStatus = 'loading' | 'loaded' | 'error';
export const useLocalDbFacadeStatus = (): LocalDbFacadeStatus => {
    const localDbFacade = useLocalDbFacade();

    const databasePromiseResult = usePromise(localDbFacade.databasePromise);

    if (databasePromiseResult === undefined) {
        return 'loading';
    }

    if ('error' in databasePromiseResult) {
        return 'error';
    }

    return 'loaded';
};
