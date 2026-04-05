import { useRef, useState } from "react";
import { useTablesContext } from "../../contexts/TablesContext";
import { Note } from "../../controllers/Note";

export function useNote(params: {
  // TODO: rename to noteId
  listId: string;
  showError: (message: string) => void;
}): [number, Note] {
  const [ver, setVer] = useState<number>(0);

  const { noteItemsTable } = useTablesContext();

  const ref = useRef<{ listId: string; note: Note } | null>(null);
  if (!ref.current || ref.current.listId !== params.listId) {
    ref.current = {
      listId: params.listId,
      note: new Note({
        ...params,
        noteItemsTable,
        onChange: () => {
          setVer((prev) => prev + 1);
        },
      }),
    };
  }
  const val = ref.current.note;

  return [ver, val];
}
