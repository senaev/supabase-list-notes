import './NotePage.css';

import { PlusIcon } from '@heroicons/react/24/solid';
import {
    KeyboardEvent,
    SyntheticEvent,
    useEffect,
    useRef,
    useState,
} from 'react';
import { captureDragAndDrop } from 'senaev-utils/src/utils/DOM/captureDragAndDrop/captureDragAndDrop';
import { noop } from 'senaev-utils/src/utils/Function/noop';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { useToastsContext } from '../../contexts/ToastsContext';
import { NoteItem } from '../../types/NoteItem';
import { useNote } from '../hooks/useNote';
import { NoteItemElement, OnNoteItemInputElementRefChangeCallback } from '../NoteItemElement/NoteItemElement';

const PLACEHOLDER_ITEM_ID_PREFIX = 'placeholder:';

const CHILD_OFFSET = 25;

type ListItemWithSortedIndex = NoteItem & {
    sortedIndex: number;
};

type DragState = {
    sourceIndex: number;
    sourceCount: number;
    dropIndex: number;
    isChild: boolean;
    x: number;
    y: number;
};

export type PendingFocus = {
    inputElementId: string;
    /**
     * If we set cursor position before react apply the value to the input,
     * the position might be incorrect after apply,
     * so we should wait for the value to be applied
     */
    expectedTitle: string;
    selectionStart: number;
    selectionEnd: number;
    saveCaretPositionAfterChange: boolean;
};

export type PendingFocusSignalValue = PendingFocus | null;

export const PENDING_FOCUS_SIGNAL = new Signal<PendingFocusSignalValue>(null, deepEqual);

function checkPendingFocus(): void {
    const pendingFocus = PENDING_FOCUS_SIGNAL.getValue();

    if (pendingFocus == null) {
        return;
    }

    const {
        inputElementId,
        expectedTitle,
        selectionEnd,
        selectionStart,
        saveCaretPositionAfterChange,
    } = pendingFocus;

    const input = inputElements.get(inputElementId);

    if (!input) {
        return;
    }

    if (input.value !== expectedTitle) {
        return;
    }

    if (!saveCaretPositionAfterChange) {
        ignoreNextSelection = true;
    }

    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
    PENDING_FOCUS_SIGNAL.dispatch(null);
}

PENDING_FOCUS_SIGNAL.subscribe(checkPendingFocus);

let ignoreNextSelection = false;
let desiredCaretPosition = 0;
const inputElements = new Map<string, HTMLTextAreaElement>();
const onNoteItemInputElementRefChange: OnNoteItemInputElementRefChangeCallback = (id, inputElement) => {
    if (inputElement) {
        inputElements.set(id, inputElement);
        checkPendingFocus();
    } else {
        inputElements.delete(id);
    }
};

function saveCaretPosition(event: SyntheticEvent<HTMLTextAreaElement>) {
    if (ignoreNextSelection) {
        ignoreNextSelection = false;

        return;
    }

    const {
        selectionDirection, selectionStart, selectionEnd,
    } = event.currentTarget;
    const caretPosition = selectionDirection === 'backward' ? selectionStart : selectionEnd;

    if (caretPosition == null) {
        return;
    }

    const lineStart = event.currentTarget.value.lastIndexOf('\n', caretPosition - 1) + 1;
    const nextDesiredCaretPosition = caretPosition - lineStart;

    desiredCaretPosition = nextDesiredCaretPosition;
}

export function NotePage({ noteId }: { noteId: string }) {
    const { showError } = useToastsContext();
    const note = useNote({
        noteId,
        showError,
    });
    const [
        dragState,
        setDragState,
    ] = useState<DragState | null>(null);
    const itemsContainerRef = useRef<HTMLDivElement>(null);
    const itemsContainer = itemsContainerRef.current;

    const parentGroups = note.getItemsInfo();
    const unchecked = parentGroups.uncheckedFlatten;
    const checked = parentGroups.checkedFlatten;

    useEffect(() => {
        inputElements.forEach((input) => {
            resizeTextarea(input);
        });
    }, [note]);

    function resizeTextarea(input: HTMLTextAreaElement) {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }

    function isCaretOnFirstLine(input: HTMLTextAreaElement) {
        const caretPosition = input.selectionStart ?? 0;

        return !input.value.slice(0, caretPosition).includes('\n');
    }

    function isCaretOnLastLine(input: HTMLTextAreaElement) {
        const caretPosition = input.selectionEnd ?? input.value.length;

        return !input.value.slice(caretPosition).includes('\n');
    }

    function handleItemKeyDown(
        event: KeyboardEvent<HTMLTextAreaElement>,
        item: NoteItem
    ) {
        const { selectionStart, selectionEnd } = event.currentTarget;

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            if (selectionStart == null || selectionEnd == null) {
                showError('Unable to determine caret position');

                return;
            }

            note.createItemAfter({
                id: item.id,
                selectionStart,
                selectionEnd,
            });
        }

        if (
            (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'l'
        ) {
            event.preventDefault();
            note.toggleChecked(item.id, !item.completed_at);
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            const hasSelection = selectionStart !== selectionEnd;
            const shouldMoveToAdjacentItem = !hasSelection && (event.key === 'ArrowUp'
                ? isCaretOnFirstLine(event.currentTarget)
                : isCaretOnLastLine(event.currentTarget));

            if (!shouldMoveToAdjacentItem) {
                ignoreNextSelection = true;

                return;
            }

            event.preventDefault();
            const sourceInputId = item.id;
            const direction = event.key === 'ArrowUp' ? 'up' : 'down';

            const currentParentGroups = note.getItemsInfo();
            const currentUnchecked = currentParentGroups.uncheckedFlatten;
            const currentChecked = currentParentGroups.checkedFlatten;

            const sortedItems = currentUnchecked.find((currentItem) => currentItem.id === sourceInputId)
                ? currentUnchecked
                : currentChecked;

            const currentIndex = sortedItems.findIndex((currentItem) => currentItem.id === sourceInputId);

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
            const maxPositionInFirstLine = firstLineLength === -1 ? targetItem.title.length : firstLineLength;
            const selectionPosition = Math.min(
                desiredCaretPosition,
                maxPositionInFirstLine
            );

            PENDING_FOCUS_SIGNAL.dispatch({
                inputElementId: targetItem.id,
                expectedTitle: targetItem.title,
                selectionStart: selectionPosition,
                selectionEnd: selectionPosition,
                saveCaretPositionAfterChange: false,
            });
        }

        if (
            event.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0
        ) {
            event.preventDefault();

            note.mergeItemWithPrevious(item.id);
        }
    }

    const sortedItemsWithPlaceholders: ListItemWithSortedIndex[] = [
        ...unchecked.map((item, index) => {
            return {
                ...item,
                sortedIndex: index,
            };
        }),
    ];

    if (dragState) {
        const {
            sourceIndex, sourceCount, dropIndex,
        } = dragState;

        if (dropIndex !== sourceIndex) {
            Array.from({ length: sourceCount }).forEach((_, i) => {
                const placeholder: ListItemWithSortedIndex = {
                    ...unchecked[sourceIndex + i],
                    id: `${PLACEHOLDER_ITEM_ID_PREFIX}${i}`,
                    sortedIndex: -1,
                };
                const placeholderIndex = dropIndex > sourceIndex ? dropIndex + sourceCount : dropIndex;

                sortedItemsWithPlaceholders.splice(placeholderIndex, 0, placeholder);
            });
        }
    }

    return <>
        <div
            className={'NotePage__items'}
            ref={itemsContainerRef}
        >
            {sortedItemsWithPlaceholders.map((item) => <NoteItemElement
                key={item.id}
                item={item}
                toggleChecked={(nextChecked) => {
                    note.toggleChecked(item.id, nextChecked);
                }}
                onChange={(value) => {
                    note.persistItem(item.id, { title: value });
                }}
                onKeyDown={(event) => {
                    handleItemKeyDown(event, item);
                }}
                onTextSelectionChange={saveCaretPosition}
                onRemove={() => {
                    note.removeItem(item.id);
                }}
                dragState={(() => {
                    if (!dragState) {
                        return undefined;
                    }

                    if (item.id.startsWith(PLACEHOLDER_ITEM_ID_PREFIX)) {
                        return 'placeholder';
                    }

                    const {
                        sourceIndex, sourceCount, dropIndex,
                    } = dragState;

                    if (item.sortedIndex >= 0) {
                        if (
                            item.sortedIndex < sourceIndex || item.sortedIndex >= sourceIndex + sourceCount
                        ) {
                            return undefined;
                        }
                    }

                    if (dropIndex === sourceIndex) {
                        return 'source';
                    }

                    return 'source-collapsed';
                })()}
                onDragStart={(event) => {
                    if (!itemsContainer) {
                        showError('Unable to start drag and drop: items container not found');

                        return;
                    }

                    const dragElement = event.target as HTMLElement;
                    const dragItemElement = dragElement.closest('.NoteItemElement')!;

                    const dragItemRect = dragItemElement.getBoundingClientRect();

                    const cursorToDragElementOffset = {
                        x: event.clientX - dragItemRect.left,
                        y: event.clientY - dragItemRect.top,
                    };

                    const itemsContainerRect = itemsContainer.getBoundingClientRect();
                    const initialCursorOffset = {
                        x: event.clientX - itemsContainerRect.left,
                        y: event.clientY - itemsContainerRect.top,
                    };

                    const initialItemContainerOffsetY = dragItemRect.top - itemsContainerRect.top;

                    const sourceIndex = unchecked.findIndex((i) => i.id === item.id);
                    let sourceCount = 1;

                    if (!item.is_child) {
                        for (let i = sourceIndex + 1; i < unchecked.length; i++) {
                            if (unchecked[i].is_child) {
                                sourceCount++;
                            } else {
                                break;
                            }
                        }
                    }

                    const otherItemsVerticalCenters: number[] = [];
                    const itemElements = Array.from(itemsContainer.querySelectorAll('.NoteItemElement'));
                    let movingItemsHeight = 0;

                    itemElements.forEach((otherItemElement, i) => {
                        const rect = otherItemElement.getBoundingClientRect();

                        if (i >= sourceIndex && i < sourceIndex + sourceCount) {
                            movingItemsHeight += rect.height;

                            return;
                        }

                        let center = rect.top + rect.height / 2 - itemsContainerRect.top;

                        if (i > sourceIndex) {
                            center -= movingItemsHeight;
                        }

                        otherItemsVerticalCenters.push(center);
                    });

                    let currentDragState: DragState = {
                        sourceIndex,
                        sourceCount,
                        dropIndex: sourceIndex,
                        isChild: item.is_child,
                        x: dragItemRect.left - itemsContainerRect.left,
                        y: dragItemRect.top - itemsContainerRect.top,
                    };

                    setDragState(currentDragState);

                    captureDragAndDrop(event.nativeEvent, (pointerEvent, isStop) => {
                        if (isStop) {
                            setDragState(null);

                            const { dropIndex, isChild } = currentDragState;

                            note.moveItems(item.id, {
                                dropIndex:
                      dropIndex > sourceIndex
                          ? dropIndex + sourceCount
                          : dropIndex,
                                isChild,
                                count: sourceCount,
                            });

                            return;
                        }

                        const nextItemsContainerRect = itemsContainer.getBoundingClientRect();
                        const offset = {
                            x: pointerEvent.clientX - nextItemsContainerRect.left,
                            y: pointerEvent.clientY - nextItemsContainerRect.top,
                        };

                        const dropIndex = (() => {
                            const moveOffset = offset.y - initialCursorOffset.y + initialItemContainerOffsetY;

                            for (let i = 0; i < otherItemsVerticalCenters.length; i++) {
                                const center = otherItemsVerticalCenters[i];

                                if (moveOffset < center) {
                                    return i;
                                }
                            }

                            return otherItemsVerticalCenters.length;
                        })();

                        const dragRight = offset.x - cursorToDragElementOffset.x;
                        const isChild: boolean = (() => {
                            if (dragRight >= CHILD_OFFSET) {
                                return true;
                            }

                            if (dragRight < -CHILD_OFFSET) {
                                return false;
                            }

                            return item.is_child;
                        })();

                        const nextDragState: DragState = {
                            sourceIndex,
                            sourceCount,
                            dropIndex,
                            isChild,
                            x: offset.x - cursorToDragElementOffset.x,
                            y: offset.y - cursorToDragElementOffset.y,
                        };

                        currentDragState = nextDragState;
                        setDragState(nextDragState);
                    });
                }}
                resizeTextarea={resizeTextarea}
                onNoteItemInputElementRefChange={onNoteItemInputElementRefChange}
                readonlyText={false}
            />)}
            <button
                className={'NotePage__addItemButton'}
                onClick={() => {
                    note.createNewItemAtTheEnd();
                }}
                type={'button'}
            >
                <PlusIcon className={'NotePage_addItemButton__icon'}/>
                {'Item'}
            </button>

            {dragState
                ? <div
                    className={'NotePage__dragOverlay'}
                    style={{
                        transform: `translateY(${dragState.y}px)`,
                    }}
                >
                    {[...Array.from({ length: dragState.sourceCount }, (_, i) => i)].map((i) => {
                        const item = unchecked[dragState.sourceIndex + i];
                        const is_child: boolean = (() => {
                            if (i > 0) {
                                return true;
                            }

                            if (dragState.dropIndex === 0) {
                                return false;
                            }

                            if (dragState.isChild) {
                                return true;
                            }

                            return false;
                        })();

                        return <NoteItemElement
                            key={i}
                            dragState={'overlay'}
                            onNoteItemInputElementRefChange={onNoteItemInputElementRefChange}
                            item={{
                                ...item,
                                is_child,
                            }}
                            onChange={noop}
                            onKeyDown={noop}
                            onRemove={noop}
                            onTextSelectionChange={noop}
                            onDragStart={noop}
                            readonlyText={true}
                            resizeTextarea={resizeTextarea}
                            toggleChecked={noop}
                        />;
                    })}
                </div>
                : null}
        </div>
        <div>
            {checked.length > 0 && <>
                <hr className={'items-separator'}/>
                {checked.map((item) => <NoteItemElement
                    key={item.id}
                    item={item}
                    toggleChecked={(nextChecked) => {
                        note.toggleChecked(item.id, nextChecked);
                    }}
                    onChange={noop}
                    onKeyDown={noop}
                    onTextSelectionChange={saveCaretPosition}
                    onRemove={() => {
                        note.removeItem(item.id);
                    }}
                    dragState={undefined}
                    onDragStart={undefined}
                    resizeTextarea={noop}
                    onNoteItemInputElementRefChange={onNoteItemInputElementRefChange}
                    readonlyText={true}
                />)}
            </>}
        </div>
    </>;
}
