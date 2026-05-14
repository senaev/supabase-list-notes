import {
    useEffect, useMemo,
    useState,
} from 'react';

import { useNoteItemsStore } from '../../contexts/NoteItemsStoreContext';
import { Note } from '../../controllers/Note';

export function useNote({
    noteId,
    showError,
}: {
    noteId: string;
    showError: (message: string) => void;
}): Note {
    const [
        _ver,
        setVer,
    ] = useState<number>(0);

    const noteItemsStore = useNoteItemsStore();
    const note = useMemo(() => {
        const newNote = new Note({
            noteItemsStore,
            noteId,
            onChange: () => {
                setVer((prev) => prev + 1);
            },
            showError,
        });

        return newNote;
    }, [
        noteItemsStore,
        noteId,
        showError,
    ]);

    useEffect(() => () => {
        note.destroy();
    }, [
        note,
        noteItemsStore,
        noteId,
        showError,
    ]);

    return note;
}
