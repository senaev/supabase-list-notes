import { Latch } from 'senaev-utils/src/utils/Latch/Latch';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { combineSignalsIntoNewOne } from 'senaev-utils/src/utils/Signal/combineSignalsIntoNewOne/combineSignalsIntoNewOne';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { PENDING_FOCUS_SIGNAL } from '../components/NotePage/NotePage';
import { NoteItem, NoteItemId } from '../types/NoteItem';
import { shiftItemsToInsertOnPosition } from '../utils/shiftItemsToInsertOnPosition/shiftItemsToInsertOnPosition';

import { NoteItemCreateParams, NoteItemsStore } from './NoteItemsStore';

export type ItemParentGroupMap = Map<NoteItem, NoteItem[]>;
export type ItemsInfo = {
    allItems: NoteItem[];
    uncheckedParentGroupMap: ItemParentGroupMap;
    uncheckedFlatten: NoteItem[];
    checkedParentGroupMap: ItemParentGroupMap;
    checkedFlatten: NoteItem[];
    itemMap: Map<NoteItemId, NoteItem>;
    childToParentMap: Map<NoteItemId, NoteItem>;
};

function flattenGroups(groups: ItemParentGroupMap): NoteItem[] {
    return [...groups.entries()].reduce<NoteItem[]>((acc, [
        parent,
        children,
    ]) => {
        acc.push(parent, ...children);

        return acc;
    }, []);
}

function getItemsSortedGroupedByParent(sorted: NoteItem[]): {
    parentToChildrenMap: ItemParentGroupMap;
    childToParentMap: Map<NoteItemId, NoteItem>;
} {
    const parentToChildrenMap: ItemParentGroupMap = new Map();
    const childToParentMap: Map<NoteItemId, NoteItem> = new Map();
    let currentParent: NoteItem | null = null;

    for (const item of sorted) {
        if (item.is_child && currentParent) {
            parentToChildrenMap.get(currentParent)!.push(item);
            childToParentMap.set(item.id, currentParent);
        } else {
            currentParent = item;
            parentToChildrenMap.set(currentParent, []);
        }
    }

    return {
        parentToChildrenMap,
        childToParentMap,
    };
}

export class Note {
    public readonly getItemsInfo: () => ItemsInfo;

    private readonly destroyLatch = new Latch();

    public constructor(private readonly params: {
        noteItemsStore: NoteItemsStore;
        noteId: string;
        onChange: () => void;
        showError: (message: string) => void;
    }) {
        const {
            signal: currentNoteRecordsSignal,
            teardown,
        } = combineSignalsIntoNewOne(
            [this.params.noteItemsStore.recordsSignal],
            (noteItems) => {
                const filtered = noteItems
                    .filter((item) => item.note_id === this.params.noteId);

                const itemMap = new Map<string, NoteItem>();

                filtered.forEach((item) => {
                    itemMap.set(item.id, item);
                });

                const sorted = filtered.sort((first, second) => first.position - second.position);

                const { parentToChildrenMap, childToParentMap } = getItemsSortedGroupedByParent(sorted);

                const checkedArr: {
                    parent: NoteItem;
                    children: NoteItem[];
                }[] = [];
                const uncheckedParentGroupMap: ItemParentGroupMap = new Map();

                for (const [
                    parent,
                    children,
                ] of parentToChildrenMap.entries()) {
                    if (
                        parent.completed_at && children.every((child) => child.completed_at)
                    ) {
                        checkedArr.push({
                            parent,
                            children,
                        });
                    } else {
                        uncheckedParentGroupMap.set(parent, children);
                    }
                }

                checkedArr.sort((first, second) => {
                    const firstCheckTime = new Date(first.parent.completed_at!).getTime();
                    const secondCheckTime = new Date(second.parent.completed_at!).getTime();

                    return secondCheckTime - firstCheckTime;
                });

                const checkedParentGroupMap: ItemParentGroupMap = new Map();

                checkedArr.forEach(({
                    parent,
                    children,
                }) => {
                    checkedParentGroupMap.set(parent, children);
                });

                const uncheckedFlatten = flattenGroups(uncheckedParentGroupMap);
                const checkedFlatten = flattenGroups(checkedParentGroupMap);

                const grouped: ItemsInfo = {
                    allItems: sorted,
                    itemMap,
                    childToParentMap,
                    checkedParentGroupMap,
                    uncheckedParentGroupMap,
                    uncheckedFlatten,
                    checkedFlatten,
                };

                return grouped;
            },
            deepEqual
        );

        this.getItemsInfo = () => currentNoteRecordsSignal.getValue();

        subscribeSignalAndCallWithCurrentValue(currentNoteRecordsSignal, () => {
            params.onChange();
        });

        this.destroyLatch.subscribe(teardown);
    }

    public destroy(): void {
        this.destroyLatch.dispatch(undefined);
    }

    public removeItem(id: string) {
        this.params.noteItemsStore.deleteNoteItem(id).catch((error) => {
            this.params.showError(error.message);
        });
    }

    public persistItem(
        id: string,
        updates: Partial<
            Pick<NoteItem, 'title' | 'position' | 'completed_at' | 'is_child'>
        >
    ): void {
        const now = new Date();
        const nowString = now.toISOString();

        const nextItem = this.changeItemLocally(id, {
            ...updates,
            updated_at: nowString,
            _modified: nowString,
        });

        if (!nextItem) {
            this.params.showError(`persistItem: item not found id=[${id}]`);

            return;
        }

        this.params.noteItemsStore
            .updateNoteItem(now, {
                ...nextItem,
                _deleted: false,
            })
            .catch((error) => {
                this.params.showError(`persistItem: error id=[${id}] [${error.message}]`);
            });
    }

    public moveItems(
        id: string,
        {
            dropIndex,
      isChild,
      count,
        }: {
            dropIndex: number;
            isChild: boolean;
            count: number;
        }
    ) {
        const uncheckedGroups = this.getItemsInfo();

        const unchecked = flattenGroups(uncheckedGroups.uncheckedParentGroupMap);

        const sourceIndex = unchecked.findIndex((item) => item.id === id);

        if (sourceIndex === -1) {
            this.params.showError(`moveItem: item not found with id=[${id}]`);

            return;
        }

        const sourceItem = unchecked[sourceIndex];

        if (!sourceItem) {
            this.params.showError(`moveItem: item not found on sourceIndex=[${sourceIndex}]`);

            return;
        }

        if (sourceIndex === dropIndex && sourceItem.is_child === isChild) {
            return;
        }

        const itemsToMove = unchecked.slice(sourceIndex, sourceIndex + count);

        let startPosition = 1;
        let firstItemIsChild = false;

        if (dropIndex > 0) {
            const previousItem = unchecked[dropIndex - 1];

            if (!previousItem) {
                this.params.showError(`moveItem: no previousItem for dropIndex=[${dropIndex}]`);

                return;
            }

            startPosition = previousItem.position + 1;

            if (isChild) {
                firstItemIsChild = true;
            }
        }

        this.shiftElementsToInsertOnPosition(startPosition, count);

        for (let i = 0; i < count; i++) {
            const item = itemsToMove[i];

            const position = startPosition + i;
            const is_child = i === 0 ? firstItemIsChild : true;

            this.persistItem(item.id, {
                position,
                is_child,
            });
        }
    }

    public insertItem({
        title,
        completed_at,
        position,
        is_child,
    }: {
        title: string;
        completed_at: string | null;
        position: number;
        is_child: boolean;
    }) {
        this.shiftElementsToInsertOnPosition(position, 1);

        const newItem: NoteItemCreateParams = {
            id: crypto.randomUUID(),
            note_id: this.params.noteId,
            title,
            position,
            completed_at,
            is_child,
        };

        PENDING_FOCUS_SIGNAL.dispatch({
            inputElementId: newItem.id,
            expectedTitle: newItem.title,
            selectionStart: 0,
            selectionEnd: 0,
            saveCaretPositionAfterChange: true,
        });

        this.params.noteItemsStore
            .createNoteItem(newItem)
            .then(() => {})
            .catch((error) => {
                this.params.showError(error.message);
            });
    }

    public createNewItemAtTheEnd() {
        const nextPosition = Date.now();

        this.insertItem({
            title: '',
            completed_at: null,
            position: nextPosition,
            is_child: false,
        });
    }

    public createItemAfter({
        id,
        selectionStart,
        selectionEnd,
    }: {
        id: string;
        selectionStart: number;
        selectionEnd: number;
    }) {
        const currentItem = this.getItemsInfo().itemMap.get(id);

        if (!currentItem) {
            this.params.showError(`createItemAfter: item not found id=[${id}]`);

            return;
        }

        const titlePrevious = currentItem.title.slice(0, selectionStart);
        const titleNew = currentItem.title.slice(selectionEnd);

        const previousParams = { title: titlePrevious };

        this.persistItem(id, previousParams);

        const nextPosition = currentItem.position + 1;

        this.insertItem({
            title: titleNew,
            is_child: currentItem.is_child,
            completed_at: currentItem.completed_at,
            position: nextPosition,
        });
    }

    public toggleChecked(id: string, checked: boolean): void {
        const { itemMap, childToParentMap } = this.getItemsInfo();
        const item = itemMap.get(id);

        if (!item) {
            this.params.showError(`toggleChecked: item not found id=[${id}]`);

            return;
        }

        const now = new Date().toISOString();
        const completed_at = checked ? now : null;

        this.persistItem(id, { completed_at });

        if (item.is_child) {
            const parentItem: NoteItem | undefined = childToParentMap.get(id);

            if (!parentItem) {
                this.params.showError(`toggleChecked: parent item not found for id=[${id}]`);

                return;
            }

            this.persistItem(parentItem.id, {});
        }
    }

    public mergeItemWithPrevious(id: string) {
        const { uncheckedFlatten, itemMap } = this.getItemsInfo();

        const currentIndex = uncheckedFlatten.findIndex((item) => item.id === id);
        const currentItem = itemMap.get(id);

        if (!currentItem) {
            this.params.showError(`mergeItemWithPrevious: item not found id=[${id}]`);

            return;
        }

        if (currentIndex === -1) {
            this.params.showError(`mergeItemWithPrevious: item not found in uncheckedFlatten id=[${id}]`);

            return;
        }

        if (currentIndex === 0) {
            return;
        }

        const previousItem = uncheckedFlatten[currentIndex - 1];
        const mergedTitle = previousItem.title + currentItem.title;

        const cursorPosition = previousItem.title.length;

        this.persistItem(previousItem.id, { title: mergedTitle });

        this.removeItem(currentItem.id);

        PENDING_FOCUS_SIGNAL.dispatch({
            inputElementId: previousItem.id,
            expectedTitle: mergedTitle,
            selectionStart: cursorPosition,
            selectionEnd: cursorPosition,
            saveCaretPositionAfterChange: true,
        });
    }

    private shiftElementsToInsertOnPosition(position: number, count: number) {
        const shiftedItems = shiftItemsToInsertOnPosition(
            this.getItemsInfo().allItems,
            position,
            count
        );

        for (const [
            id,
            nextPosition,
        ] of shiftedItems.entries()) {
            this.persistItem(id, { position: nextPosition });
        }
    }

    private changeItemLocally(id: string, updates: Partial<NoteItem>): NoteItem | undefined {
        const { recordsSignal } = this.params.noteItemsStore;

        let nextItem: NoteItem | undefined = undefined;

        recordsSignal.dispatch(recordsSignal.getValue().map((item) => {
            if (item.id !== id) {
                return item;
            }

            nextItem = {
                ...item,
                ...updates,
            };

            return nextItem;
        }));

        return nextItem;
    }
}
