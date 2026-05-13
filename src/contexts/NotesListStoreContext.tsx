import {
    createContext,
    PropsWithChildren,
    useContext,
    useMemo,
} from 'react';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { NoteRecord, NotesListStore } from '../controllers/NotesListStore';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

type NotesListStoreContextType = NotesListStore | undefined;

const NotesListStoreContext = createContext<NotesListStoreContextType>(undefined);

NotesListStoreContext.displayName = 'NotesListStoreContext';

export const NotesListStoreContextProvider = ({
    children,
    showError,
}: PropsWithChildren & {
    showError: (message: string) => void;
}) => {
    const localDbFacade = useExistingLocalDbFacade();
    const { clientSignal } = useSupabaseControllerStatus();

    const notesList = useMemo(() => new NotesListStore({
        localDbFacade,
        supabaseControllerClientSignal: clientSignal,
        showError,
    }), [
        localDbFacade,
        clientSignal,
        showError,
    ]);

    return <NotesListStoreContext.Provider value={notesList}>
        {children}
    </NotesListStoreContext.Provider>;
};

export const useNotesListStore = (): NotesListStore => {
    const notesList = useContext(NotesListStoreContext);

    if (!notesList) {
        throw new Error('useNotesListContext must be used inside NotesListContext.Provider');
    }

    return notesList;
};

export const useNotesListRecords = (): NoteRecord[] | undefined => {
    const { recordsSignal } = useNotesListStore();

    const items = useSignal(recordsSignal);

    return items;
};
