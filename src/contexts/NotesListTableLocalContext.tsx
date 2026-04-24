import {
    createContext,
    PropsWithChildren,
    useContext,
    useMemo,
} from 'react';

import { NotesListTableLocal } from '../tables/NotesListTableLocal';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';

const NotesListTableLocalContext = createContext<NotesListTableLocal | undefined>(undefined);

NotesListTableLocalContext.displayName = 'NotesListTableLocalContext';

export function NotesListTableLocalContextProvider({ children }: PropsWithChildren) {
    const localDbFacade = useExistingLocalDbFacade();

    const notesListTableLocal = useMemo(
        () => new NotesListTableLocal(localDbFacade),
        [localDbFacade]
    );

    return <NotesListTableLocalContext.Provider value={notesListTableLocal}>
        {children}
    </NotesListTableLocalContext.Provider>;
}

export const useNotesListTableLocal = (): NotesListTableLocal => {
    const notesListTableLocal = useContext(NotesListTableLocalContext);

    if (!notesListTableLocal) {
        throw new Error('useNotesListTableLocal must be used within a NotesListTableLocalContextProvider');
    }

    return notesListTableLocal;
};
