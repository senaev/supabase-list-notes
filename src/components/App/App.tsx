import './App.css';

import { SupabaseClient } from '@supabase/supabase-js';
import { Route, Routes } from 'react-router-dom';
import { PropsWithChildren } from 'react';

import { useActiveItemsPresence } from '../../presence/useActiveItemsPresence';
import { useItemsSync } from '../../sync/useItemsSync';
import { AuthPage } from '../AuthPage/AuthPage';
import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';
import { NotePage } from '../NotePage/NotePage';
import { Page404 } from '../Page404/Page404';
import { useItemSyncStoreContext } from '../../contexts/ItemSyncStoreContext';
import { OptimisticAsyncStore } from '../../sync/ItemsSyncStore';
import { LocalDbContextProvider } from '../../contexts/LocalDbFacadeContext';
import {
    SupabaseControllerStatusContextProvider,
    useSupabaseControllerStatus,
} from '../../contexts/SupabaseControllerStatusContext';
import { LocalItemRow } from '../../sync/localDb';

export function ItemsApp({
    itemSyncStore,
    supabaseClient,
}: {
    itemSyncStore: OptimisticAsyncStore<LocalItemRow>;
    supabaseClient: SupabaseClient;
}) {
    const sync = useItemsSync({ itemSyncStore });
    const presence = useActiveItemsPresence(supabaseClient);

    return (
        <>
            <MainPageHeader
                activeEditorEmojisByItemId={presence.emojisByItemId}
                items={sync.items}
                networkSyncStatus={sync.networkSyncStatus}
                typesByPopularity={sync.typesByPopularity}
            />
            <NotePage presence={presence} sync={sync} />
        </>
    );
}

export function NotesApp({ supabaseClient }: { supabaseClient: SupabaseClient }) {
    const itemSyncStore = useItemSyncStoreContext({ supabaseClient });

    return (
        <Routes>
            <Route
                path={'/'}
                element={<ItemsApp itemSyncStore={itemSyncStore} supabaseClient={supabaseClient} />}
            />
            <Route path={'*'} element={<Page404 />} />
        </Routes>
    );
}

export function NotesWithAuthApp() {
    const supabaseStatusObject = useSupabaseControllerStatus();

    if (supabaseStatusObject.status === 'ready') {
        const supabaseClient = supabaseStatusObject.clientSignal.getValue();

        if (!supabaseClient) {
            return 'Waiting Spabase Client from Signal';
        }

        return <NotesApp supabaseClient={supabaseClient} />;
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

export function NotesAppDatabaseProviders({ children }: PropsWithChildren) {
    return (
        <SupabaseControllerStatusContextProvider>
            <LocalDbContextProvider>{children}</LocalDbContextProvider>
        </SupabaseControllerStatusContextProvider>
    );
}

export function App() {
    return (
        <div className={'App__page'}>
            <main className={'App__main'}>
                <NotesAppDatabaseProviders>
                    <NotesWithAuthApp />
                </NotesAppDatabaseProviders>
            </main>
        </div>
    );
}
