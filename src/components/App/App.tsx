import './App.css';

import {
    Navigate, Route, Routes, useParams,
} from 'react-router-dom';

import { LocalDbFacadeContextProvider, useLocalDbFacade } from '../../contexts/LocalDbFacadeContext';
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
import { NotesListTableLocal } from '../../tables/NotesListTableLocal';
import { AuthPage } from '../AuthPage/AuthPage';
import { ErrorPage } from '../ErrorPage/ErrorPage';
import { LoadingPage } from '../LoadingPage/LoadingPage';
import { MainPage } from '../MainPage/MainPage';
import { NoteHeader } from '../NoteHeader/NoteHeader';
import { NotePage } from '../NotePage/NotePage';

export function NoteRouteElement() {
    const { noteId } = useParams<{ noteId: string }>();
    const notes = useNoteRecords();

    if (!noteId) {
        return <ErrorPage errorMessage={'404: Note id absent'}/>;
    }

    if (notes === undefined) {
        return <LoadingPage/>;
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
        return <LoadingPage/>;
    }

    return <AuthPage statusObject={supabaseControllerStatus}/>;
}

// TODO: move somewhere else
const supabaseController = new SupabaseController();

export function NotesAppInitializer() {
    const localDbFacadeContextValue = useLocalDbFacade();

    if (localDbFacadeContextValue === undefined) {
        return <LoadingPage/>;
    }

    if ('error' in localDbFacadeContextValue) {
        return <ErrorPage errorMessage={`Failed to initialize local database: ${localDbFacadeContextValue.error}`}/>;
    }

    const supabaseControllerStatus = useSupabaseControllerStatus();

    if (supabaseControllerStatus.status === 'require-credentials' || supabaseControllerStatus.status === 'wrong-credentials') {
        return <AuthRouteElement/>;
    }

    return <SupabaseControllerStatusContextProvider supabaseController={supabaseController}>
        <LocalDbFacadeContextProvider>
            <NotesListTableLocalContextProvider>
                <NotesApp/>
            </NotesListTableLocalContextProvider>
        </LocalDbFacadeContextProvider>
    </SupabaseControllerStatusContextProvider>;
}

export function App() {
    return <div className={'App__page'}>
        <main className={'App__main'}>
            <NotesAppInitializer/>
        </main>
    </div>;
}
