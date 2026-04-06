import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { NotesList } from "../controllers/NotesList";
import { useTablesContext } from "./TablesContext";

type NotesListContextType = NotesList | undefined;

const NotesListContext = createContext<NotesListContextType>(undefined);
NotesListContext.displayName = "NotesListContext";

export const NotesListContextProvider = ({
  children,
  showError,
}: PropsWithChildren & {
  showError: (message: string) => void;
}) => {
  const tables = useTablesContext();

  const [, setNotesListVer] = useState<number>(0);
  const notesListRef = useRef<NotesList | null>(null);
  if (!notesListRef.current) {
    notesListRef.current = new NotesList({
      notesListTable: tables.notesListTable,
      showError,
      onChange: () => {
        setNotesListVer((prev) => prev + 1);
      },
    });
  }
  const notesList = notesListRef.current;

  useEffect(() => {
    notesList.connect();

    return () => {
      notesList.dispose();
    };
  }, [notesList]);

  return (
    <NotesListContext.Provider value={notesList}>
      {children}
    </NotesListContext.Provider>
  );
};

export const useNotesListContext = (): NotesList => {
  const notesList = useContext(NotesListContext);
  if (!notesList) {
    throw new Error(
      "useNotesListContext must be used inside NotesListContext.Provider",
    );
  }

  return notesList;
};
