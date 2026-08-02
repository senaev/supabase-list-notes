import './NotePage.css';

import { PlusIcon } from '@heroicons/react/24/solid';
import { KeyboardEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToastsContext } from '../../contexts/ToastsContext';
import { UseActiveItemsPresenceResult } from '../../presence/useActiveItemsPresence';
import { Item } from '../../sync/types';
import { UseItemsSyncResult } from '../../sync/useItemsSync';
import { NoteItemElement } from '../NoteItemElement/NoteItemElement';

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
        .sort((a, b) => Date.parse(b.checked_at as string) - Date.parse(a.checked_at as string));
}

export function NotePage({
    sync,
    presence,
}: {
    sync: UseItemsSyncResult;
    presence: UseActiveItemsPresenceResult;
}) {
    const { showError } = useToastsContext();
    const [searchParams] = useSearchParams();
    const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);
    const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
    const desiredCaretPositionRef = useRef(0);
    const ignoreNextSelectionRef = useRef(false);

    useEffect(() => {
        if (sync.error) {
            showError(sync.error);
        }
    }, [sync.error, showError]);

    // Set by clicking a chip in ItemTypesNav (in MainPageHeader); cleared by
    // the home button navigating back to ROUTES.home with no search params.
    const typeFilter = searchParams.get('type');

    const visibleItems = typeFilter
        ? sync.items.filter((item) => item.type === typeFilter)
        : sync.items;

    const unchecked = sortUnchecked(visibleItems);
    const checked = sortChecked(visibleItems);

    // Distinct types across *all* items (not just the currently filtered
    // ones), alphabetical, for the per-item type picker's "choose an
    // existing one" list - it should offer every type in the list, not just
    // the ones visible under the current filter.
    const existingTypes = useMemo(
        () =>
            Array.from(new Set(sync.items.map((item) => item.type))).sort((a, b) =>
                a.localeCompare(b),
            ),
        [sync.items],
    );

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
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }

    function moveCaretBetweenItems({ id, direction }: { id: string; direction: 'up' | 'down' }) {
        const sortedItems = unchecked.find((item) => item.id === id) ? unchecked : checked;

        const currentIndex = sortedItems.findIndex((item) => item.id === id);

        if (currentIndex === -1) {
            showError('Unable to find item to move caret from');
            return;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const targetItem = sortedItems[targetIndex];

        if (!targetItem) {
            return;
        }

        const firstLineLength = targetItem.title.indexOf('\n');
        const maxPositionInFirstLine =
            firstLineLength === -1 ? targetItem.title.length : firstLineLength;
        const selectionPosition = Math.min(desiredCaretPositionRef.current, maxPositionInFirstLine);
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

        const { selectionDirection, selectionStart, selectionEnd } = event.currentTarget;
        const caretPosition = selectionDirection === 'backward' ? selectionStart : selectionEnd;

        if (caretPosition == null) {
            return;
        }

        const lineStart = event.currentTarget.value.lastIndexOf('\n', caretPosition - 1) + 1;
        const nextDesiredCaretPosition = caretPosition - lineStart;
        desiredCaretPositionRef.current = nextDesiredCaretPosition;
    }

    function isCaretOnFirstLine(input: HTMLTextAreaElement) {
        const caretPosition = input.selectionStart ?? 0;
        return !input.value.slice(0, caretPosition).includes('\n');
    }

    function isCaretOnLastLine(input: HTMLTextAreaElement) {
        const caretPosition = input.selectionEnd ?? input.value.length;
        return !input.value.slice(caretPosition).includes('\n');
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

        // Copy the original item's type onto the new item created by the split.
        const newId = sync.addItem(titleNew, currentItem.type);
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

        // Only `title` is patched here, so the merged item keeps the previous
        // item's type (left untouched) rather than the current (removed)
        // item's.
        sync.updateItem(previousItem.id, { title: mergedTitle });
        sync.removeItem(currentItem.id);
        setPendingFocus({
            id: previousItem.id,
            selectionStart: cursorPosition,
            selectionEnd: cursorPosition,
        });
    }

    function handleItemKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, item: Item) {
        const { selectionStart, selectionEnd } = event.currentTarget;
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            if (selectionStart == null || selectionEnd == null) {
                showError('Unable to determine caret position');
                return;
            }

            createItemAfter({ id: item.id, selectionStart, selectionEnd });
        }

        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'l') {
            event.preventDefault();
            sync.updateItem(item.id, {
                checked_at: item.checked_at ? null : new Date().toISOString(),
            });
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            const hasSelection = selectionStart !== selectionEnd;
            const shouldMoveToAdjacentItem =
                !hasSelection &&
                (event.key === 'ArrowUp'
                    ? isCaretOnFirstLine(event.currentTarget)
                    : isCaretOnLastLine(event.currentTarget));

            if (!shouldMoveToAdjacentItem) {
                ignoreNextSelectionRef.current = true;
                return;
            }

            event.preventDefault();
            moveCaretBetweenItems({
                id: item.id,
                direction: event.key === 'ArrowUp' ? 'up' : 'down',
            });
        }

        if (event.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
            event.preventDefault();

            mergeItemWithPrevious(item.id);
        }
    }

    function handleItemChange(id: string, title: string) {
        // Also reported on focus (see the onFocus props below); repeating it
        // here is what keeps the claim from going idle while the user is
        // actively typing without ever re-focusing. Only an actual change of
        // item reaches the network, so this is safe per keystroke.
        presence.setActiveItem(id);
        sync.updateItem(id, { title });
    }

    function createNewItemAtTheEnd() {
        // Default the new item to the active type filter (if any), so it
        // doesn't immediately vanish from the filtered view it was just
        // created in.
        const newId = sync.addItem('', typeFilter ?? undefined);
        setPendingFocus({ id: newId, selectionStart: 0, selectionEnd: 0 });
    }

    return (
        <>
            <div className="NotePage__items">
                {unchecked.map((item) => {
                    return (
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
                            onChangeType={(type) => {
                                sync.updateItem(item.id, { type });
                            }}
                            onFocus={() => {
                                presence.setActiveItem(item.id);
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
                            activeEditorEmojis={presence.emojisByItemId[item.id]}
                            readonlyText={false}
                            existingTypes={existingTypes}
                            truncateType={Boolean(typeFilter)}
                        />
                    );
                })}
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
                                onChangeType={(type) => {
                                    sync.updateItem(item.id, { type });
                                }}
                                onFocus={() => {}}
                                onKeyDown={() => {}}
                                onTextSelectionChange={saveCaretPosition}
                                onRemove={() => {
                                    sync.removeItem(item.id);
                                }}
                                resizeTextarea={() => {}}
                                inputRefs={inputRefs}
                                // A checked item can't be focused (it renders as plain
                                // text), but it can still be someone's active item from
                                // just before they checked it, so avatars are shown here
                                // too rather than silently disappearing.
                                activeEditorEmojis={presence.emojisByItemId[item.id]}
                                readonlyText={true}
                                existingTypes={existingTypes}
                                truncateType={Boolean(typeFilter)}
                            />
                        ))}
                    </>
                )}
            </div>
        </>
    );
}
