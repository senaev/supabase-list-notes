import './App.css';

import { SupabaseClient } from '@supabase/supabase-js';
import {
    Navigate, Route, Routes, useParams,
} from 'react-router-dom';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import {
    NotesListContextProvider,
    useNotesListContext,
} from '../../contexts/NotesListContext';
import {
    SupabaseControllerContextProvider,
    useSupabaseController,
} from '../../contexts/SupabaseControllerContext';
import { TablesContextProvider } from '../../contexts/TablesContext';
import { useToastsContext } from '../../contexts/ToastsContext';
import { LocalDbFacade } from '../../localDb/LocalDbFacade';
import { AuthPage } from '../AuthPage/AuthPage';
import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPage } from '../MainPage/MainPage';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';
import { NoteHeader } from '../NoteHeader/NoteHeader';
import { NotePage } from '../NotePage/NotePage';
import { Page404 } from '../Page404/Page404';

export function NoteRouteElement() {
    const { noteId } = useParams<{ noteId: string }>();
    const { items } = useNotesListContext();

    if (!noteId) {
        return <Page404/>;
    }

    if (items === undefined) {
        return <>
            {/* TODO: implement persistence and remove noop */}
            <MainPageHeader
                createNewNote={noop}
                menu={[]}
            />
            <LoadingPageContent/>
        </>;
    }

    const noteExists = items.some((list) => list.id === noteId);

    if (!noteExists) {
        return <Page404/>;
    }

    return <>
        <NoteHeader
            noteId={noteId}
            jumpToEdit={() => {
                // TODO: implement
            }}
        />
        <NotePage noteId={noteId}/>
    </>;
}

export function NotesApp({
    supabaseClient,
}: {
    supabaseClient?: SupabaseClient;
}) {
    const { showError } = useToastsContext();

    return <TablesContextProvider
        key={supabaseClient ? 'tables-with-supabase' : 'tables-local-only'}
        localDbFacade={localDbFacade}
        supabaseClient={supabaseClient}
        showError={showError}
    >
        <NotesListContextProvider showError={showError}>
            <Routes>
                <Route
                    path={'/'}
                    element={<MainPage/>}
                />
                <Route
                    path={'/auth'}
                    element={<AuthRouteElement/>}
                />
                <Route
                    path={'/:noteId'}
                    element={<NoteRouteElement/>}
                />
                <Route
                    path={'*'}
                    element={<Page404/>}
                />
            </Routes>
        </NotesListContextProvider>
    </TablesContextProvider>;
}

function AuthRouteElement() {
    const supabaseStatusObject = useSupabaseController().status;

    if (supabaseStatusObject.status === 'ready') {
        return <Navigate
            to={'/'}
            replace={true}
        />;
    }

    if (supabaseStatusObject.status === 'initialization') {
        return <>
            {/* TODO: implement persistence and remove noop */}
            <MainPageHeader
                createNewNote={noop}
                menu={[]}
            />
            <LoadingPageContent/>
        </>;
    }

    return <AuthPage statusObject={supabaseStatusObject}/>;
}

export function NotesWithAuthApp() {
    const supabaseStatusObject = useSupabaseController().status;

    return <>
        <NotesApp
            supabaseClient={
                supabaseStatusObject.status === 'ready'
                    ? supabaseStatusObject.client
                    : undefined
            }
        />
    </>;
}

const localDbFacade = new LocalDbFacade();

export function App() {
    return <div className={'App__page'}>
        <main className={'App__main'}>
            <SupabaseControllerContextProvider>
                <NotesWithAuthApp/>
            </SupabaseControllerContextProvider>
        </main>
    </div>;
}
