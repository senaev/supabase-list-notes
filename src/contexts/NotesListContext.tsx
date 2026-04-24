import {
    createContext,
    PropsWithChildren,
    useContext,
    useRef,
} from 'react';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { NoteRecord, NotesList } from '../controllers/NotesList';

import { useNotesListTableLocal } from './NotesListTableLocalContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

type NotesListContextType = NotesList | undefined;

const NotesListContext = createContext<NotesListContextType>(undefined);

NotesListContext.displayName = 'NotesListContext';

export const NotesListContextProvider = ({
    children,
    showError,
}: PropsWithChildren & {
    showError: (message: string) => void;
}) => {
    const notesListTableLocal = useNotesListTableLocal();
    const { clientSignal } = useSupabaseControllerStatus();
    const notesListRef = useRef<NotesList | null>(null);

    if (!notesListRef.current) {
        notesListRef.current = new NotesList({
            notesListTableLocal,
            supabaseClientSignal: clientSignal,
            showError,
        });
    }

    return <NotesListContext.Provider value={notesListRef.current}>
        {children}
    </NotesListContext.Provider>;
};

export const useNotesListContext = (): NotesList => {
    const notesList = useContext(NotesListContext);

    if (!notesList) {
        throw new Error('useNotesListContext must be used inside NotesListContext.Provider');
    }

    return notesList;
};

export const useNoteRecords = (): NoteRecord[] | undefined => {
    const { recordsSignal } = useNotesListContext();

    const items = useSignal(recordsSignal);

    return items;
};
