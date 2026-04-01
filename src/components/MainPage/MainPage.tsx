import "./MainPage.css";

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UNTITLED_PLACEHOLDER } from "../../const/UNTITLED_PLACEHOLDER";
import { useNotesListContext } from "../../contexts/NotesListContext";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { FullPageContent } from "../FullPageContent/FullPageContent";
import { MainPageHeader } from "../MainPageHeader/MainPageHeader";

import {
  ArrowLeftOnRectangleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { NBSP } from "../../const/NBSP";
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
    const aUpdated = new Date(a.updated).getTime();
    const bUpdated = new Date(b.updated).getTime();

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
            <span>{`${list.items_count - list.undone_items_count}/${list.items_count}`}</span>
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
  const lists = useNotesListContext();

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
    const { id } = await lists.createNewOne();

    navigate(`/${id}`);
  };

  return (
    <div className="MainPage">
      <MainPageHeader
        createNewNote={createNewNote}
        menu={
          <ContextMenu
            items={[
              {
                label: `Share${NBSP}access`,
                Icon: ShareIcon,
                onSelect: () => {
                  navigator.clipboard
                    .writeText(
                      JSON.stringify(statusObject.credentials, null, 2),
                    )
                    .then(() => {
                      showInfoMessage(
                        "Share link copied to clipboard. ⚠️ ANYONE with this link will have full access to your notes.",
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
        }
      />
      <MainPageContent createNewNote={createNewNote} />
    </div>
  );
}
