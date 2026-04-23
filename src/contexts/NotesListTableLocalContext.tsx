import {
    createContext,
    PropsWithChildren,
    useContext,
} from 'react';

import { NotesListTableLocal } from '../tables/NotesListTableLocal';

const NotesListTableLocalContext = createContext<NotesListTableLocal | undefined>(undefined);

NotesListTableLocalContext.displayName = 'NotesListTableLocalContext';

export function NotesListTableLocalContextProvider({ children, notesListTableLocal }: PropsWithChildren & {
    notesListTableLocal: NotesListTableLocal;
}) {
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
