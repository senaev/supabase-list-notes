import { ArrowLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { NBSP } from "../../const/NBSP";
import { ROUTES } from "../../const/ROUTES";
import { UNTITLED_PLACEHOLDER } from "../../const/UNTITLED_PLACEHOLDER";
import { useNotesListContext } from "../../contexts/NotesListContext";
import { TablesContext } from "../../contexts/TablesContext";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { PageHeader } from "../PageHeader/PageHeader";
import { ReplicationStatusIndicator } from "../ReplicationStatusIndicator/ReplicationStatusIndicator";
import "./NoteHeader.css";

export function NoteHeader({
  noteId,
  jumpToEdit,
}: {
  noteId: string;
  jumpToEdit: VoidFunction;
}) {
  const navigate = useNavigate();

  const notes = useNotesListContext();
  const tables = useContext(TablesContext);
  const replicationStatus = tables?.replicationStatus;

  function handleListTitleChange(title: string) {
    notes.changeTitleLocally(noteId, title);
    notes.persistTitle(noteId, title);
  }

  const noteItem = notes.items?.find((list) => list.id === noteId);
  return (
    <PageHeader homeButtonIcon={<ArrowLeftIcon className="NoteHeader__icon" />}>
      {noteItem ? (
        <input
          className="NoteHeader__titleInput"
          value={noteItem.title}
          onChange={(event) => {
            handleListTitleChange(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();

              jumpToEdit();
            }
          }}
          placeholder={UNTITLED_PLACEHOLDER}
          autoFocus={!noteItem.title.trim()}
        />
      ) : null}
      {replicationStatus ? (
        <ReplicationStatusIndicator status={replicationStatus} />
      ) : null}
      <ContextMenu
        items={[
          {
            label: `Delete${NBSP}note`,
            Icon: TrashIcon,
            onSelect: () => {
              navigate(ROUTES.home, {
                state: { deleteNoteId: noteId },
              });
            },
          },
        ]}
      />
    </PageHeader>
  );
}
