import "./MainPage.css";

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UNTITLED_PLACEHOLDER } from "../../const/UNTITLED_PLACEHOLDER";
import { useNotesListContext } from "../../contexts/NotesListContext";
import { useTablesContext } from "../../contexts/TablesContext";
import { FullPageContent } from "../FullPageContent/FullPageContent";
import { MainPageHeader } from "../MainPageHeader/MainPageHeader";

import {
  ArrowLeftOnRectangleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { APP_BASE_URL } from "../../const/APP_BASE_URL";
import { NBSP } from "../../const/NBSP";
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from "../../const/SUPABASE_CREDENTIALS_QUERY_PARAMS";
import { useSupabaseClientContext } from "../../contexts/SupabaseClientContext";
import { useToastsContext } from "../../contexts/ToastsContext";
import { LoadingPageContent } from "../LoadingPageContent/LoadingPageContent";

function MainPageContent({ createNewNote }: { createNewNote: VoidFunction }) {
  const { items } = useNotesListContext();
  const { noteItemsStore } = useTablesContext();
  const navigate = useNavigate();
  const [countsByNoteId, setCountsByNoteId] = useState<
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
        if (item.completed_at == null) {
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

  if (items === undefined) {
    return <LoadingPageContent />;
  }

  if (items.length === 0) {
    return (
      <FullPageContent>
        <button
          type="button"
          className="MainPage__addFirstListButton"
          aria-label="Add my first list"
          onClick={createNewNote}
        >
          <span className="MainPage__fullPageContent__icon">🚀</span>
          <span className="MainPage__fullPageContent__title">
            Create first note
          </span>
        </button>
      </FullPageContent>
    );
  }

  const itemsSorted = [...items].sort((a, b) => {
    const aUpdated = new Date(a.updated_at).getTime();
    const bUpdated = new Date(b.updated_at).getTime();

    return bUpdated - aUpdated;
  });

  return (
    <div className="MainPage__items">
      {itemsSorted.map((list) => {
        const counts = countsByNoteId.get(list.id) ?? {
          items_count: 0,
          open_items_count: 0,
        };

        return (
          <button
            key={list.id}
            type="button"
            className="MainPage__item"
            onClick={() => {
              navigate(`/${list.id}`);
            }}
          >
            {list.title.trim() ? (
              <span className="MainPage__itemTitle">{list.title}</span>
            ) : (
              <span
                className="MainPage__itemTitle"
                style={{
                  opacity: 0.5,
                }}
              >
                {UNTITLED_PLACEHOLDER}
              </span>
            )}
            <span className="MainPage__itemMeta">
              <span>{`${counts.items_count - counts.open_items_count}/${counts.items_count}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showInfoMessage } = useToastsContext();
  const notes = useNotesListContext();
  const statusObject = useSupabaseClientContext();

  useEffect(() => {
    const deleteNoteId = location.state?.deleteNoteId;
    if (deleteNoteId == null) {
      return;
    }

    notes.delete(deleteNoteId);

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location, navigate, notes]);

  if (statusObject.status !== "ready") {
    throw new Error("Supabase client is not ready in MainPage component");
  }

  const createNewNote = async () => {
    // TODO: handle errors and show error message to user
    const { id } = await notes.createNewNote();

    navigate(`/${id}`);
  };

  return (
    <div className="MainPage">
      <MainPageHeader
        createNewNote={createNewNote}
        menu={[
          {
            label: `Share${NBSP}access`,
            Icon: ShareIcon,
            onSelect: () => {
              const shareUrl = new URL(APP_BASE_URL, window.location.origin);
              Object.entries(SUPABASE_CREDENTIALS_QUERY_PARAMS).forEach(
                ([credentialKey, queryParam]) => {
                  const credentialValue =
                    statusObject.credentials[
                      credentialKey as keyof typeof statusObject.credentials
                    ];
                  shareUrl.searchParams.set(queryParam, credentialValue);
                },
              );

              navigator.clipboard
                .writeText(shareUrl.toString())
                .then(() => {
                  showInfoMessage(
                    "Share link copied to clipboard. ⚠️ Anyone with this link can view and edit your notes.",
                  );
                })
                .catch((error) => {
                  showError(
                    `Failed to copy credentials to clipboard. Error: ${error.message}`,
                  );
                });
            },
          },
          {
            label: "Logout",
            Icon: ArrowLeftOnRectangleIcon,
            onSelect: () => {
              statusObject.logout();
            },
          },
        ]}
      />
      <MainPageContent createNewNote={createNewNote} />
    </div>
  );
}
