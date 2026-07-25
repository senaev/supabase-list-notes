import {
    createContext,
    PropsWithChildren,
    useContext,
    useMemo,
} from 'react';
import { useSignal } from 'senaev-utils/src/utils/Signal/useSignal';

import { NoteItemsStore } from '../controllers/NoteItemsStore';
import { NoteItem } from '../types/NoteItem';

import { useExistingLocalDbFacade } from './LocalDbFacadeContext';
import { useSupabaseControllerStatus } from './SupabaseControllerContext';

export type NoteItemsStoreContextType = NoteItemsStore | undefined;

const NoteItemsStoreContext = createContext<NoteItemsStoreContextType>(undefined);

NoteItemsStoreContext.displayName = 'NotesListStoreContext';

export const NoteItemsStoreContextProvider = ({
    children,
    showError,
}: PropsWithChildren & {
    showError: (message: string) => void;
}) => {
    const localDbFacade = useExistingLocalDbFacade();
    const { clientSignal } = useSupabaseControllerStatus();

    const noteItems = useMemo(() => new NoteItemsStore({
        localDbFacade,
        supabaseControllerClientSignal: clientSignal,
        showError,
    }), [
        localDbFacade,
        clientSignal,
        showError,
    ]);

    return <NoteItemsStoreContext.Provider value={noteItems}>
        {children}
    </NoteItemsStoreContext.Provider>;
};

export const useNoteItemsStore = (): NoteItemsStore => {
    const noteItems = useContext(NoteItemsStoreContext);

    if (!noteItems) {
        throw new Error('useNotesListContext must be used inside NotesListContext.Provider');
    }

    return noteItems;
};

export const useNoteItemsRecords = (): NoteItem[] | undefined => {
    const { recordsSignal } = useNoteItemsStore();

    const items = useSignal(recordsSignal);

    return items;
};
