import {
    useEffect, useRef, useState,
} from 'react';

import { useTablesContext } from '../../contexts/TablesContext';
import { Note } from '../../controllers/Note';

export function useNote(params: {
    noteId: string;
    showError: (message: string) => void;
}): [number, Note] {
    const [
        ver,
        setVer,
    ] = useState<number>(0);

    const { noteItemsStore, noteItemsTable } = useTablesContext();

    const ref = useRef<{ noteId: string; note: Note } | null>(null);

    if (!ref.current || ref.current.noteId !== params.noteId) {
        ref.current?.note.dispose();
        ref.current = {
            noteId: params.noteId,
            note: new Note({
                ...params,
                noteItemsStore,
                noteItemsTable,
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
    }, [val]);

    return [
        ver,
        val,
    ];
}
