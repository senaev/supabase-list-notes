import "./NotePage.css";

import { PlusIcon } from "@heroicons/react/24/solid";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KeyboardEvent,
  SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useToastsContext } from "../../contexts/ToastsContext";
import { useItemsSync } from "../../sync/useItemsSync";
import { Item } from "../../sync/types";
import { NoteItemElement } from "../NoteItemElement/NoteItemElement";

type PendingFocus = {
  id: string;
  selectionStart: number;
  selectionEnd: number;
};

function sortUnchecked(items: Item[]): Item[] {
  return items
    .filter((item) => item.checked_at === null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

function sortChecked(items: Item[]): Item[] {
  return items
    .filter((item) => item.checked_at !== null)
    .sort(
      (a, b) => Date.parse(b.checked_at as string) - Date.parse(a.checked_at as string),
    );
}

export function NotePage({
  supabaseClient,
}: {
  supabaseClient: SupabaseClient;
}) {
  const { showError } = useToastsContext();
  const sync = useItemsSync(supabaseClient);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const desiredCaretPositionRef = useRef(0);
  const ignoreNextSelectionRef = useRef(false);

  useEffect(() => {
    if (sync.error) {
      showError(sync.error);
    }
  }, [sync.error, showError]);

  const unchecked = sortUnchecked(sync.items);
  const checked = sortChecked(sync.items);

  useEffect(() => {
    if (pendingFocus == null) {
      return;
    }

    const { selectionEnd, selectionStart, id } = pendingFocus;

    const input = inputRefs.current.get(id);
    if (!input) {
      return;
    }

    ignoreNextSelectionRef.current = true;
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
    setPendingFocus(null);
  }, [pendingFocus, sync.items]);

  useEffect(() => {
    inputRefs.current.forEach((input) => {
      resizeTextarea(input);
    });
  }, [sync.items]);

  function resizeTextarea(input: HTMLTextAreaElement) {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }

  function moveCaretBetweenItems({
    id,
    direction,
  }: {
    id: string;
    direction: "up" | "down";
  }) {
    const sortedItems = unchecked.find((item) => item.id === id)
      ? unchecked
      : checked;

    const currentIndex = sortedItems.findIndex((item) => item.id === id);

    if (currentIndex === -1) {
      showError("Unable to find item to move caret from");
      return;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetItem = sortedItems[targetIndex];

    if (!targetItem) {
      return;
    }

    const firstLineLength = targetItem.title.indexOf("\n");
    const maxPositionInFirstLine =
      firstLineLength === -1 ? targetItem.title.length : firstLineLength;
    const selectionPosition = Math.min(
      desiredCaretPositionRef.current,
      maxPositionInFirstLine,
    );
    setPendingFocus({
      id: targetItem.id,
      selectionStart: selectionPosition,
      selectionEnd: selectionPosition,
    });
  }

  function saveCaretPosition(event: SyntheticEvent<HTMLTextAreaElement>) {
    if (ignoreNextSelectionRef.current) {
      ignoreNextSelectionRef.current = false;
      return;
    }

    const { selectionDirection, selectionStart, selectionEnd } =
      event.currentTarget;
    const caretPosition =
      selectionDirection === "backward" ? selectionStart : selectionEnd;

    if (caretPosition == null) {
      return;
    }

    const lineStart =
      event.currentTarget.value.lastIndexOf("\n", caretPosition - 1) + 1;
    const nextDesiredCaretPosition = caretPosition - lineStart;
    desiredCaretPositionRef.current = nextDesiredCaretPosition;
  }

  function isCaretOnFirstLine(input: HTMLTextAreaElement) {
    const caretPosition = input.selectionStart ?? 0;
    return !input.value.slice(0, caretPosition).includes("\n");
  }

  function isCaretOnLastLine(input: HTMLTextAreaElement) {
    const caretPosition = input.selectionEnd ?? input.value.length;
    return !input.value.slice(caretPosition).includes("\n");
  }

  function createItemAfter({
    id,
    selectionStart,
    selectionEnd,
  }: {
    id: string;
    selectionStart: number;
    selectionEnd: number;
  }) {
    const currentItem = unchecked.find((item) => item.id === id);

    if (!currentItem) {
      showError(`createItemAfter: item not found id=[${id}]`);
      return;
    }

    const titlePrevious = currentItem.title.slice(0, selectionStart);
    const titleNew = currentItem.title.slice(selectionEnd);

    sync.updateItem(id, { title: titlePrevious });

    const newId = sync.addItem(titleNew);
    setPendingFocus({ id: newId, selectionStart: 0, selectionEnd: 0 });
  }

  function mergeItemWithPrevious(id: string) {
    const currentIndex = unchecked.findIndex((item) => item.id === id);

    if (currentIndex <= 0) {
      return;
    }

    const currentItem = unchecked[currentIndex];
    const previousItem = unchecked[currentIndex - 1];
    const mergedTitle = previousItem.title + currentItem.title;
    const cursorPosition = previousItem.title.length;

    sync.updateItem(previousItem.id, { title: mergedTitle });
    sync.removeItem(currentItem.id);
    setPendingFocus({
      id: previousItem.id,
      selectionStart: cursorPosition,
      selectionEnd: cursorPosition,
    });
  }

  function handleItemKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    item: Item,
  ) {
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (selectionStart == null || selectionEnd == null) {
        showError("Unable to determine caret position");
        return;
      }

      createItemAfter({ id: item.id, selectionStart, selectionEnd });
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "l"
    ) {
      event.preventDefault();
      sync.updateItem(item.id, {
        checked_at: item.checked_at ? null : new Date().toISOString(),
      });
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const hasSelection = selectionStart !== selectionEnd;
      const shouldMoveToAdjacentItem =
        !hasSelection &&
        (event.key === "ArrowUp"
          ? isCaretOnFirstLine(event.currentTarget)
          : isCaretOnLastLine(event.currentTarget));

      if (!shouldMoveToAdjacentItem) {
        ignoreNextSelectionRef.current = true;
        return;
      }

      event.preventDefault();
      moveCaretBetweenItems({
        id: item.id,
        direction: event.key === "ArrowUp" ? "up" : "down",
      });
    }

    if (
      event.key === "Backspace" &&
      selectionStart === 0 &&
      selectionEnd === 0
    ) {
      event.preventDefault();

      mergeItemWithPrevious(item.id);
    }
  }

  function handleItemChange(id: string, title: string) {
    sync.updateItem(id, { title });
  }

  function createNewItemAtTheEnd() {
    const newId = sync.addItem("");
    setPendingFocus({ id: newId, selectionStart: 0, selectionEnd: 0 });
  }

  return (
    <>
      <div className="NotePage__items">
        {unchecked.map((item) => (
          <NoteItemElement
            key={item.id}
            item={item}
            toggleChecked={(isChecked) => {
              sync.updateItem(item.id, {
                checked_at: isChecked ? new Date().toISOString() : null,
              });
            }}
            onChange={(value) => {
              handleItemChange(item.id, value);
            }}
            onKeyDown={(event) => {
              handleItemKeyDown(event, item);
            }}
            onTextSelectionChange={saveCaretPosition}
            onRemove={() => {
              sync.removeItem(item.id);
            }}
            resizeTextarea={resizeTextarea}
            inputRefs={inputRefs}
            readonlyText={false}
          />
        ))}
        <button
          className="NotePage__addItemButton"
          onClick={createNewItemAtTheEnd}
          type="button"
        >
          <PlusIcon className="NotePage_addItemButton__icon" />
          Item
        </button>
      </div>
      <div>
        {checked.length > 0 && (
          <>
            <hr className="items-separator" />
            {checked.map((item) => (
              <NoteItemElement
                key={item.id}
                item={item}
                toggleChecked={(isChecked) => {
                  sync.updateItem(item.id, {
                    checked_at: isChecked ? new Date().toISOString() : null,
                  });
                }}
                onChange={() => {}}
                onKeyDown={() => {}}
                onTextSelectionChange={saveCaretPosition}
                onRemove={() => {
                  sync.removeItem(item.id);
                }}
                resizeTextarea={() => {}}
                inputRefs={inputRefs}
                readonlyText={true}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
