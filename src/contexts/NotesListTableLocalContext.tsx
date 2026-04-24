import {
    createContext,
    PropsWithChildren,
    useContext,
    useRef,
} from 'react';

import { LocalDbFacade } from '../localDb/LocalDbFacade';
import { NotesListTableLocal } from '../tables/NotesListTableLocal';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';

const NotesListTableLocalContext = createContext<NotesListTableLocal | undefined>(undefined);

NotesListTableLocalContext.displayName = 'NotesListTableLocalContext';

export function NotesListTableLocalContextProvider({ children }: PropsWithChildren) {
    const localDbFacade = useExistingLocalDbFacade();
    const notesListTableLocalRef = useRef<{
        localDbFacade: LocalDbFacade;
        notesListTableLocal: NotesListTableLocal;
    } | undefined>(undefined);

    if (notesListTableLocalRef.current === undefined || notesListTableLocalRef.current.localDbFacade !== localDbFacade) {
        notesListTableLocalRef.current = {
            localDbFacade,
            notesListTableLocal: new NotesListTableLocal(localDbFacade),
        };
    }

    const { notesListTableLocal } = notesListTableLocalRef.current;

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
