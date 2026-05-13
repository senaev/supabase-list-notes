import {
    useEffect, useRef, useState,
} from 'react';

import { useNoteItemsStore } from '../../contexts/NoteItemsStoreContext';
import { Note } from '../../controllers/Note';

export function useNote(params: {
    noteId: string;
    showError: (message: string) => void;
}): [number, Note] {
    const [
        ver,
        setVer,
    ] = useState<number>(0);

    const noteItemsStore = useNoteItemsStore();

    const ref = useRef<{ noteId: string; note: Note } | null>(null);

    // eslint-disable-next-line react-hooks/refs
    if (!ref.current || ref.current.noteId !== params.noteId) {
        // eslint-disable-next-line react-hooks/refs
        ref.current?.note.dispose();
        ref.current = {
            noteId: params.noteId,
            note: new Note({
                ...params,
                noteItemsStore,
                onChange: () => {
                    setVer((prev) => prev + 1);
                },
            }),
        };
    }

    const val = ref.current.note;

    useEffect(() => {
        val.connect();

        return () => {
            val.dispose();
        };
    // eslint-disable-next-line react-hooks/refs
    }, [val]);

    // eslint-disable-next-line react-hooks/refs
    return [
        ver,
        // eslint-disable-next-line react-hooks/refs
        val,
    ];
}
