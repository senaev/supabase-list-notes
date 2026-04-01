import { useRef, useState } from "react";
import { useTablesContext } from "../../contexts/TablesContext";
import { Note } from "../../controllers/Note";

export function useNote(params: {
  listId: number;
  showError: (message: string) => void;
}): [number, Note] {
  const [ver, setVer] = useState<number>(0);

  const { noteItemsTable } = useTablesContext();

  const ref = useRef<Note | null>(null);
  if (!ref.current) {
    ref.current = new Note({
      ...params,
      noteItemsTable,
      onChange: () => {
        setVer((prev) => prev + 1);
      },
    });
  }
  const val = ref.current;

  return [ver, val];
}
