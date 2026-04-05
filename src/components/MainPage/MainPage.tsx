import "./MainPage.css";

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UNTITLED_PLACEHOLDER } from "../../const/UNTITLED_PLACEHOLDER";
import { useNotesListContext } from "../../contexts/NotesListContext";
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
  const navigate = useNavigate();

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
      {itemsSorted.map((list) => (
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
            <span>{`${list.items_count - list.open_items_count}/${list.items_count}`}</span>
          </span>
        </button>
      ))}
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
    const deleteListId = location.state?.deleteListId;
    if (deleteListId == null) {
      return;
    }

    notes.delete(deleteListId);

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
