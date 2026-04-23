import './App.css';

import {
    Navigate, Route, Routes, useParams,
} from 'react-router-dom';
import { noop } from 'senaev-utils/src/utils/Function/noop';

import { LocalDbFacadeContextProvider } from '../../contexts/LocalDbFacadeContext';
import {
    NotesListContextProvider,
    useNoteRecords,
} from '../../contexts/NotesListContext';
import { NotesListTableLocalContextProvider } from '../../contexts/NotesListTableLocalContext';
import {
    SupabaseControllerStatusContextProvider,
    useSupabaseControllerStatus,
} from '../../contexts/SupabaseControllerContext';
import { TablesContextProvider } from '../../contexts/TablesContext';
import { useToastsContext } from '../../contexts/ToastsContext';
import { SupabaseController } from '../../controllers/SupabaseController';
import { LocalDbFacade } from '../../localDb/LocalDbFacade';
import { NotesListTableLocal } from '../../tables/NotesListTableLocal';
import { AuthPage } from '../AuthPage/AuthPage';
import { ErrorPage } from '../ErrorPage/ErrorPage';
import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPage } from '../MainPage/MainPage';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';
import { NoteHeader } from '../NoteHeader/NoteHeader';
import { NotePage } from '../NotePage/NotePage';

export function NoteRouteElement() {
    const { noteId } = useParams<{ noteId: string }>();
    const notes = useNoteRecords();

    if (!noteId) {
        return <ErrorPage errorMessage={'404: Note id absent'}/>;
    }

    if (notes === undefined) {
        return <>
            {/* TODO: implement persistence and remove noop */}
            <MainPageHeader
                createNewNote={noop}
                menu={[]}
            />
            <LoadingPageContent/>
        </>;
    }

    const noteExists = notes.some((list) => list.id === noteId);

    if (!noteExists) {
        return <ErrorPage errorMessage={'404: Note not found'}/>;
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

export function NotesApp() {
    const { showError } = useToastsContext();

    return <TablesContextProvider showError={showError}>
        <NotesListContextProvider showError={showError}>
            <Routes>
                <Route
                    path={'/'}
                    element={<MainPage/>}
                />
                <Route
                    path={'/:noteId'}
                    element={<NoteRouteElement/>}
                />
                <Route
                    path={'*'}
                    element={<ErrorPage errorMessage={'404: Page not found'}/>}
                />
            </Routes>
        </NotesListContextProvider>
    </TablesContextProvider>;
}

function AuthRouteElement() {
    const supabaseControllerStatus = useSupabaseControllerStatus();

    if (supabaseControllerStatus.status === 'ready') {
        return <Navigate
            to={'/'}
            replace={true}
        />;
    }

    if (supabaseControllerStatus.status === 'initialization') {
        return <>
            {/* TODO: implement persistence and remove noop */}
            <MainPageHeader
                createNewNote={noop}
                menu={[]}
            />
            <LoadingPageContent/>
        </>;
    }

    return <AuthPage statusObject={supabaseControllerStatus}/>;
}

export function NotesWithAuthApp() {
    const supabaseControllerStatus = useSupabaseControllerStatus();

    if (supabaseControllerStatus.status === 'require-credentials' || supabaseControllerStatus.status === 'wrong-credentials') {
        return <AuthRouteElement/>;
    }

    return <>
        <NotesApp/>
    </>;
}

// TODO: move somewhere else
const localDbFacade = new LocalDbFacade();

// TODO: move somewhere else
const notesListTableLocal = new NotesListTableLocal(localDbFacade);

// TODO: move somewhere else
const supabaseController = new SupabaseController();

export function App() {
    return <div className={'App__page'}>
        <main className={'App__main'}>
            <SupabaseControllerStatusContextProvider supabaseController={supabaseController}>
                <LocalDbFacadeContextProvider localDbFacade={localDbFacade}>
                    <NotesListTableLocalContextProvider notesListTableLocal={notesListTableLocal}>
                        <NotesWithAuthApp/>
                    </NotesListTableLocalContextProvider>
                </LocalDbFacadeContextProvider>
            </SupabaseControllerStatusContextProvider>
        </main>
    </div>;
}
