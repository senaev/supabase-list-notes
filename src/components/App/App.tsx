import "./App.css";

import { SupabaseClient } from "@supabase/supabase-js";
import { useRef, useState } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import {
  NotesListContext,
  useNotesListContext,
} from "../../contexts/NotesListContext";
import {
  SupabaseClientContextProvider,
  useSupabaseClientContext,
} from "../../contexts/SupabaseClientContext";
import { TablesContext, TablesContextType } from "../../contexts/TablesContext";
import { useToastsContext } from "../../contexts/ToastsContext";
import { NotesList } from "../../controllers/NotesList";
import { NoteItemsTable } from "../../tables/NoteItemsTable";
import { NotesListTable } from "../../tables/NotesListTable";
import { noop } from "../../utils/noop";
import { AuthPage } from "../AuthPage/AuthPage";
import { LoadingPageContent } from "../LoadingPageContent/LoadingPageContent";
import { MainPage } from "../MainPage/MainPage";
import { MainPageHeader } from "../MainPageHeader/MainPageHeader";
import { NoteHeader } from "../NoteHeader/NoteHeader";
import { NotePage } from "../NotePage/NotePage";
import { Page404 } from "../Page404/Page404";

export function NoteRouteElement() {
  const { noteId } = useParams<{ noteId: string }>();
  const { items } = useNotesListContext();

  if (!noteId) {
    return <Page404 />;
  }

  if (items === undefined) {
    return (
      <>
        {/* TODO: implement persistence and remove noop */}
        <MainPageHeader createNewNote={noop} menu={[]} />
        <LoadingPageContent />
      </>
    );
  }

  const noteExists = items.some((list) => list.id === noteId);
  if (!noteExists) {
    return <Page404 />;
  }

  return (
    <>
      <NoteHeader
        noteId={noteId}
        jumpToEdit={() => {
          // TODO: implement
        }}
      />
      <NotePage noteId={noteId} />
    </>
  );
}

export function NotesApp({
  supabaseClient,
}: {
  supabaseClient: SupabaseClient;
}) {
  const { showError } = useToastsContext();

  const tablesRef = useRef<TablesContextType | null>(null);
  if (!tablesRef.current) {
    tablesRef.current = {
      notesListTable: new NotesListTable(supabaseClient),
      noteItemsTable: new NoteItemsTable(supabaseClient),
    };
  }
  const tables = tablesRef.current;

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

  return (
    <TablesContext.Provider value={tables}>
      <NotesListContext.Provider value={notesList}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/:noteId" element={<NoteRouteElement />} />
          <Route path="*" element={<Page404 />} />
        </Routes>
      </NotesListContext.Provider>
    </TablesContext.Provider>
  );
}

export function NotesWithAuthApp() {
  const supabaseStatusObject = useSupabaseClientContext();

  if (supabaseStatusObject.status === "ready") {
    return <NotesApp supabaseClient={supabaseStatusObject.client} />;
  }

  if (supabaseStatusObject.status === "initialization") {
    return (
      <>
        {/* TODO: implement persistence and remove noop */}
        <MainPageHeader createNewNote={noop} menu={[]} />
        <LoadingPageContent />
      </>
    );
  }

  return <AuthPage statusObject={supabaseStatusObject} />;
}

export function App() {
  return (
    <div className="App__page">
      <main className="App__main">
        <SupabaseClientContextProvider>
          <NotesWithAuthApp />
        </SupabaseClientContextProvider>
      </main>
    </div>
  );
}
