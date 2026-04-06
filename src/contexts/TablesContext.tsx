import { SupabaseClient } from "@supabase/supabase-js";
import React, { PropsWithChildren, useContext, useEffect, useRef } from "react";
import { NoteItemsStore } from "../controllers/NoteItemsStore";
import { NoteItemsTable } from "../tables/NoteItemsTable";
import { NotesListTable } from "../tables/NotesListTable";

export type TablesContextType = {
  notesListTable: NotesListTable;
  noteItemsTable: NoteItemsTable;
  noteItemsStore: NoteItemsStore;
};

export const TablesContext = React.createContext<TablesContextType | null>(
  null,
);
TablesContext.displayName = "TablesContext";

export const TablesContextProvider = ({
  children,
  supabaseClient,
  showError,
}: PropsWithChildren & {
  supabaseClient: SupabaseClient;
  showError: (message: string) => void;
}) => {
  const tablesRef = useRef<TablesContextType | null>(null);
  if (!tablesRef.current) {
    const noteItemsTable = new NoteItemsTable(supabaseClient);
    tablesRef.current = {
      notesListTable: new NotesListTable(supabaseClient),
      noteItemsTable,
      noteItemsStore: new NoteItemsStore({
        noteItemsTable,
        showError,
      }),
    };
  }
  const tables = tablesRef.current;

  useEffect(() => {
    tables.noteItemsStore.connect();

    return () => {
      tables.noteItemsStore.dispose();
    };
  }, [tables]);

  return (
    <TablesContext.Provider value={tables}>{children}</TablesContext.Provider>
  );
};

export const useTablesContext = (): TablesContextType => {
  const context = useContext(TablesContext);
  if (!context) {
    throw new Error("useTablesContext must be used within a TablesProvider");
  }
  return context;
};
