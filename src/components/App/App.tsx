import './App.css';

import { SupabaseClient } from '@supabase/supabase-js';
import { Route, Routes } from 'react-router-dom';
import {
    SupabaseClientContextProvider,
    useSupabaseClientContext,
} from '../../contexts/SupabaseClientContext';
import { useActiveItemsPresence } from '../../presence/useActiveItemsPresence';
import { useItemsSync } from '../../sync/useItemsSync';
import { AuthPage } from '../AuthPage/AuthPage';
import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';
import { NotePage } from '../NotePage/NotePage';
import { Page404 } from '../Page404/Page404';

export function ItemsApp({ supabaseClient }: { supabaseClient: SupabaseClient }) {
    // Lifted above NotePage so MainPageHeader can render the type filter nav
    // (see ItemTypesNav) off the same live items list, without opening a
    // second RxDB/Supabase replication instance.
    const sync = useItemsSync(supabaseClient);
    // Realtime Presence for "who is editing what" - a separate channel from
    // the one RxDB replication uses, and intentionally independent of the
    // item data itself: presence is ephemeral and never persisted.
    const presence = useActiveItemsPresence(supabaseClient);

    return (
        <>
            <MainPageHeader
                activeEditorEmojisByItemId={presence.emojisByItemId}
                items={sync.items}
                networkSyncStatus={sync.networkSyncStatus}
            />
            <NotePage presence={presence} sync={sync} />
        </>
    );
}

export function NotesApp({ supabaseClient }: { supabaseClient: SupabaseClient }) {
    return (
        <Routes>
            <Route path="/" element={<ItemsApp supabaseClient={supabaseClient} />} />
            <Route path="*" element={<Page404 />} />
        </Routes>
    );
}

export function NotesWithAuthApp() {
    const supabaseStatusObject = useSupabaseClientContext();

    if (supabaseStatusObject.status === 'ready') {
        return <NotesApp supabaseClient={supabaseStatusObject.client} />;
    }

    if (supabaseStatusObject.status === 'initialization') {
        return (
            <>
                <MainPageHeader />
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
