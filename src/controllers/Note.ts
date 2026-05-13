import { Latch } from 'senaev-utils/src/utils/Latch/Latch';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { subscribeSignalAndCallWithCurrentValue } from 'senaev-utils/src/utils/Signal/subscribeSignalAndCallWithCurrentValue/subscribeSignalAndCallWithCurrentValue';

import { NoteItem } from '../types/NoteItem';
import { shiftItemsToInsertOnPosition } from '../utils/shiftItemsToInsertOnPosition/shiftItemsToInsertOnPosition';

import { NoteItemsStore } from './NoteItemsStore';

export type PendingFocus = {
    inputElementId: string;
    selectionStart: number;
    selectionEnd: number;
};

export type ItemParentGroup = { parent: NoteItem; children: NoteItem[] };

export function flattenGroups(groups: ItemParentGroup[]): NoteItem[] {
    return groups.reduce<NoteItem[]>((acc, group) => {
        acc.push(group.parent, ...group.children);

        return acc;
    }, []);
}

const PENDING_COMPLETED_AT = '__pending__';

export class Note {
    public pendingFocusSignal = new Signal<PendingFocus | null>(null);

    public itemsSignal = new Signal<NoteItem[]>([], deepEqual);

    private destroyLatch = new Latch();

    public constructor(private readonly params: {
        noteItemsStore: NoteItemsStore;
        noteId: string;
        onChange: () => void;
        showError: (message: string) => void;
    }) {
        const unsubscribeSignal = subscribeSignalAndCallWithCurrentValue(this.params.noteItemsStore.recordsSignal, (nextRecords) => {
            const noteRecords = nextRecords.filter((item) => item.note_id === this.params.noteId);

            this.itemsSignal.dispatch(noteRecords);
        });

        this.destroyLatch.subscribe(unsubscribeSignal);

        this.itemsSignal.subscribe(params.onChange);
    }

    public destroy(): void {
        this.destroyLatch.dispatch(undefined);
    }

    public getItemsSorted(): NoteItem[] {
        return [...this.itemsSignal.getValue()].sort((first, second) => first.position - second.position);
    }

    public getItemsSortedGroupedByParent(): ItemParentGroup[] {
        const sorted = this.getItemsSorted();

        const grouped: ItemParentGroup[] = [];
        let currentGroup: ItemParentGroup | null = null;

        for (const item of sorted) {
            if (item.is_child && currentGroup) {
                currentGroup.children.push(item);
            } else {
                currentGroup = {
                    parent: item,
                    children: [],
                };
                grouped.push(currentGroup);
            }
        }

        return grouped;
    }

    public getItemGroupsSplit(): {
        checked: ItemParentGroup[];
        unchecked: ItemParentGroup[];
    } {
        const groupedByParent = this.getItemsSortedGroupedByParent();

        const checked: ItemParentGroup[] = [];
        const unchecked: ItemParentGroup[] = [];

        for (const group of groupedByParent) {
            const { parent, children } = group;

            if (
                parent.completed_at && children.every((child) => child.completed_at)
            ) {
                checked.push(group);
            } else {
                unchecked.push(group);
            }
        }

        checked.sort((first, second) => {
            const firstCheckTime = new Date(first.parent.completed_at!).getTime();
            const secondCheckTime = new Date(second.parent.completed_at!).getTime();

            return secondCheckTime - firstCheckTime;
        });

        return {
            checked,
            unchecked,
        };
    }

    public changeItemLocally(id: string, updates: Partial<NoteItem>): void {
        this.itemsSignal.dispatch(this.itemsSignal.getValue().map((item) =>
            item.id === id
                ? {
                    ...item,
                    ...updates,
                }
                : item));
    }

    public removeItemLocally(id: string): void {
        const itemToRemove = this.itemsSignal.getValue().find((item) => item.id === id);

        if (!itemToRemove) {
            this.params.showError(`removeItem: item with id ${id} not found`);

            return;
        }

        this.itemsSignal.dispatch(this.itemsSignal.getValue().filter((item) => item.id !== id));
    }

    public removeItemRemotely(id: string): void {
        this.params.noteItemsStore.deleteNoteItem(id).catch((error) => {
            this.params.showError(error.message);
        });
    }

    public removeItem(id: string) {
        const item = this.itemsSignal.getValue().find((candidate) => candidate.id === id);

        if (!item) {
            this.params.showError(`removeItem: item with id ${id} not found`);

            return;
        }

        this.removeItemLocally(id);
        this.removeItemRemotely(id);
    }

    public persistItem(
        id: string,
        updates: Partial<
            Pick<NoteItem, 'title' | 'position' | 'completed_at' | 'is_child'>
        >
    ): void {
        const itemToUpdate = this.itemsSignal.getValue().find((item) => item.id === id);

        if (!itemToUpdate) {
            this.params.showError(`persistItem: item with id ${id} not found`);

            return;
        }

        const now = new Date().toISOString();

        this.changeItemLocally(id, {
            updated_at: now,
            _modified: now,
        });

        if (updates.completed_at === PENDING_COMPLETED_AT) {
            this.params.noteItemsStore
                .setNoteItemCompleted(id, true)
                .then((result) => {
                    const localItem = this.itemsSignal.getValue().find((item) => item.id === id);

                    if (localItem) {
                        this.changeItemLocally(id, {
                            completed_at: result.completed_at,
                            updated_at: result.updated_at,
                            _modified: result._modified,
                        });
                    }
                })
                .catch((error) => {
                    const itemStillExists = this.itemsSignal.getValue().some((item) => item.id === id);

                    this.params.showError(`persistItem(setCompleted): error id=[${id}] [${error.message}] itemStillExists=[${itemStillExists}]`);
                });

            return;
        }

        this.params.noteItemsStore
            .updateNoteItem(id, updates)
            .then((result) => {
                // Check that local item has not been removed during update
                const localItem = this.itemsSignal.getValue().find((item) => item.id === id);

                if (localItem) {
                    this.changeItemLocally(id, {
                        updated_at: result.updated_at,
                        _modified: result._modified,
                    });
                }
            })
            .catch((error) => {
                const itemStillExists = this.itemsSignal.getValue().some((item) => item.id === id);

                this.params.showError(`persistItem: error id=[${id}] [${error.message}] itemStillExists=[${itemStillExists}]`);
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
        const uncheckedGroups = this.getItemGroupsSplit();

        const unchecked = flattenGroups(uncheckedGroups.unchecked);

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

            this.changeItemLocally(item.id, {
                position,
                is_child,
            });
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

        const newItem: NoteItem = {
            id: crypto.randomUUID(),
            note_id: this.params.noteId,
            title,
            created_at: '',
            updated_at: '',
            _modified: '',
            position,
            completed_at,
            is_child,
        };

        this.itemsSignal.dispatch([
            ...this.itemsSignal.getValue(),
            newItem,
        ]);

        this.pendingFocusSignal.dispatch({
            inputElementId: newItem.id,
            selectionStart: 0,
            selectionEnd: 0,
        });

        this.params.noteItemsStore
            .createNoteItem(newItem)
            .then(() => {})
            .catch((error) => {
                this.params.showError(error.message);
            });
    }

    public getPositionAtTheEnd(): number {
        return Math.max(...this.itemsSignal.getValue().map((item) => item.position), 0) + 1;
    }

    public createNewItemAtTheEnd() {
        const nextPosition = this.getPositionAtTheEnd();

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
        const currentItem = this.itemsSignal.getValue().find((item) => item.id === id);

        if (!currentItem) {
            this.params.showError(`createItemAfter: item not found id=[${id}]`);

            return;
        }

        const titlePrevious = currentItem.title.slice(0, selectionStart);
        const titleNew = currentItem.title.slice(selectionEnd);

        const previousParams = { title: titlePrevious };

        this.changeItemLocally(id, previousParams);
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
        const itemsSorted = this.getItemsSorted();

        const itemIndex = itemsSorted.findIndex((item) => item.id === id);

        if (itemIndex === -1) {
            this.params.showError(`toggleChecked: item not found id=[${id}]`);

            return;
        }

        const item = itemsSorted[itemIndex];

        if (!item) {
            this.params.showError(`toggleChecked: item not found id=[${id}]`);

            return;
        }

        this.changeItemLocally(id, {
            completed_at: checked ? PENDING_COMPLETED_AT : null,
        });

        this.params.noteItemsStore
            .setNoteItemCompleted(id, checked)
            .then((result) => {
                const localItem = this.itemsSignal.getValue().find((currentItem) => currentItem.id === id);

                if (localItem) {
                    this.changeItemLocally(id, {
                        completed_at: result.completed_at,
                        updated_at: result.updated_at,
                        _modified: result._modified,
                    });
                }
            })
            .catch((error) => {
                this.params.showError(`toggleChecked: error id=[${id}] [${error.message}]`);
            });

        if (item.is_child) {
            let parentItem: NoteItem | undefined;

            for (let i = itemIndex - 1; i >= 0; i--) {
                const isParent = !itemsSorted[i].is_child;

                if (isParent) {
                    parentItem = itemsSorted[i];
                    break;
                }
            }

            if (!parentItem) {
                this.params.showError(`toggleChecked: parent item not found for id=[${id}]`);

                return;
            }

            this.persistItem(parentItem.id, {});
        }
    }

    public mergeItemWithPrevious(id: string) {
        const sortedItems = [...this.itemsSignal.getValue()].sort((first, second) => first.position - second.position);
        const currentIndex = sortedItems.findIndex((item) => item.id === id);

        if (currentIndex <= 0) {
            return;
        }

        const currentItem = sortedItems[currentIndex];
        const previousItem = sortedItems[currentIndex - 1];
        const mergedTitle = previousItem.title + currentItem.title;
        const cursorPosition = previousItem.title.length;

        this.itemsSignal.dispatch(this.itemsSignal.getValue().map((item) => {
            if (item.id === previousItem.id) {
                return {
                    ...item,
                    title: mergedTitle,
                };
            }

            return item;
        }));

        this.persistItem(previousItem.id, { title: mergedTitle });
        this.removeItemLocally(currentItem.id);
        this.removeItemRemotely(currentItem.id);
        this.pendingFocusSignal.dispatch({
            inputElementId: previousItem.id,
            selectionStart: cursorPosition,
            selectionEnd: cursorPosition,
        });
    }

    private shiftElementsToInsertOnPosition(position: number, count: number) {
        const shiftedItems = shiftItemsToInsertOnPosition(
            this.itemsSignal.getValue(),
            position,
            count
        );

        shiftedItems.forEach((nextPosition, id) => {
            this.changeItemLocally(id, {
                position: nextPosition,
            });

            this.persistItem(id, { position: nextPosition });
        });
    }
}
