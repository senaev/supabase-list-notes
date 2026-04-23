import './MainPage.css';

import {
    ArrowLeftOnRectangleIcon,
    ArrowTopRightOnSquareIcon,
    ShareIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { APP_BASE_URL } from '../../const/APP_BASE_URL';
import { NBSP } from '../../const/NBSP';
import { ROUTES } from '../../const/ROUTES';
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from '../../const/SUPABASE_CREDENTIALS_QUERY_PARAMS';
import { UNTITLED_PLACEHOLDER } from '../../const/UNTITLED_PLACEHOLDER';
import { useNoteRecords, useNotesListContext } from '../../contexts/NotesListContext';
import { useSupabaseControllerStatus } from '../../contexts/SupabaseControllerContext';
import { useTablesContext } from '../../contexts/TablesContext';
import { useToastsContext } from '../../contexts/ToastsContext';
import { FullPageContent } from '../FullPageContent/FullPageContent';
import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';

function MainPageContent({ createNewNote }: { createNewNote: VoidFunction }) {
    const notes = useNoteRecords();
    const { noteItemsStore } = useTablesContext();
    const navigate = useNavigate();
    const [
        countsByNoteId,
        setCountsByNoteId,
    ] = useState<
        Map<string, { items_count: number; open_items_count: number }>
    >(new Map());

    useEffect(() => {
        const updateCounts = () => {
            const noteItems = noteItemsStore.getAllItems();
            const nextCountsByNoteId = new Map<
                string,
                { items_count: number; open_items_count: number }
            >();

            noteItems.forEach((item) => {
                const current = nextCountsByNoteId.get(item.note_id) ?? {
                    items_count: 0,
                    open_items_count: 0,
                };

                current.items_count += 1;
                if (item.completed_at === null) {
                    current.open_items_count += 1;
                }

                nextCountsByNoteId.set(item.note_id, current);
            });

            setCountsByNoteId(nextCountsByNoteId);
        };

        updateCounts();
        const unsubscribe = noteItemsStore.subscribe(() => {
            updateCounts();
        });

        return () => {
            unsubscribe();
        };
    }, [noteItemsStore]);

    if (notes === undefined) {
        return <LoadingPageContent/>;
    }

    if (notes.length === 0) {
        return <FullPageContent>
            <button
                type={'button'}
                className={'MainPage__addFirstListButton'}
                aria-label={'Add my first list'}
                onClick={createNewNote}
            >
                <span className={'MainPage__fullPageContent__icon'}>
                    {'🚀'}
                </span>
                <span className={'MainPage__fullPageContent__title'}>
                    {'Create first note'}
                </span>
            </button>
        </FullPageContent>;
    }

    const itemsSorted = [...notes].sort((a, b) => {
        const aUpdated = new Date(a.modified_at).getTime();
        const bUpdated = new Date(b.modified_at).getTime();

        return bUpdated - aUpdated;
    });

    return <div className={'MainPage__items'}>
        {itemsSorted.map((list) => {
            const counts = countsByNoteId.get(list.id) ?? {
                items_count: 0,
                open_items_count: 0,
            };

            return <button
                key={list.id}
                type={'button'}
                className={'MainPage__item'}
                onClick={() => {
                    navigate(`/${list.id}`);
                }}
            >
                {list.title.trim()
                    ? <span className={'MainPage__itemTitle'}>
                        {list.title}
                    </span>
                    : <span
                        className={'MainPage__itemTitle'}
                        style={{
                            opacity: 0.5,
                        }}
                    >
                        {UNTITLED_PLACEHOLDER}
                    </span>}
                <span className={'MainPage__itemMeta'}>
                    <span>
                        {`${counts.items_count - counts.open_items_count}/${counts.items_count}`}
                    </span>
                </span>
            </button>;
        })}
    </div>;
}

export function MainPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showError, showInfoMessage } = useToastsContext();
    const notesList = useNotesListContext();
    const supabaseControllerStatus = useSupabaseControllerStatus();

    useEffect(() => {
        const deleteNoteId = location.state?.deleteNoteId;

        if (deleteNoteId === undefined) {
            return;
        }

        notesList.delete(deleteNoteId);

        navigate(location.pathname, {
            replace: true,
            state: null,
        });
    }, [
        location,
        navigate,
        notesList,
    ]);

    const createNewNote = async () => {
        // TODO: handle errors and show error message to user
        const { id } = await notesList.createNewNote();

        navigate(`/${id}`);
    };

    return <div className={'MainPage'}>
        <MainPageHeader
            createNewNote={createNewNote}
            menu={[
                ...(supabaseControllerStatus.status === 'ready'
                    ? [
                        {
                            label: `Share${NBSP}access`,
                            Icon: ShareIcon,
                            onSelect: () => {
                                const shareUrl = new URL(
                                    APP_BASE_URL,
                                    window.location.origin
                                );

                                Object.entries(SUPABASE_CREDENTIALS_QUERY_PARAMS).forEach(([
                                    credentialKey,
                                    queryParam,
                                ]) => {
                                    const credentialValue = supabaseControllerStatus.credentials[
                                        credentialKey as keyof typeof supabaseControllerStatus.credentials
                                    ];

                                    shareUrl.searchParams.set(queryParam, credentialValue);
                                });

                                navigator.clipboard
                                    .writeText(shareUrl.toString())
                                    .then(() => {
                                        showInfoMessage('Share link copied to clipboard. ⚠️ Anyone with this link can view and edit your notes.');
                                    })
                                    .catch((error) => {
                                        showError(`Failed to copy credentials to clipboard. Error: ${error.message}`);
                                    });
                            },
                        },
                        {
                            label: 'Logout',
                            Icon: ArrowLeftOnRectangleIcon,
                            onSelect: () => {
                                supabaseControllerStatus.logout();
                            },
                        },
                    ]
                    : [
                        {
                            label: 'Connect Supabase',
                            Icon: ArrowTopRightOnSquareIcon,
                            onSelect: () => {
                                navigate(ROUTES.auth);
                            },
                        },
                    ]),
            ]}
        />
        <MainPageContent createNewNote={createNewNote}/>
    </div>;
}
