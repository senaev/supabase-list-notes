import { NoteItemsStore } from "./NoteItemsStore";
import { NoteItemsTable } from "../tables/NoteItemsTable";
import { NoteItem } from "../types/NoteItem";
import { shiftItemsToInsertOnPosition } from "../utils/shiftItemsToInsertOnPosition/shiftItemsToInsertOnPosition";

export type PendingFocus = {
  id: string;
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

const PENDING_COMPLETED_AT = "__pending__";

export class Note {
  pendingFocus: PendingFocus | null = null;
  private unsubscribeStore: (() => void) | null = null;

  private items: NoteItem[] = [];

  public constructor(
    private readonly params: {
      noteItemsStore: NoteItemsStore;
      noteItemsTable: NoteItemsTable;
      noteId: string;
      onChange: () => void;
      showError: (message: string) => void;
    },
  ) {}

  public connect(): void {
    if (this.unsubscribeStore) {
      return;
    }

    this.params.noteItemsStore.connect();
    this.setItems(this.params.noteItemsStore.getItems(this.params.noteId));
    this.unsubscribeStore = this.params.noteItemsStore.subscribe(() => {
      this.setItems(this.params.noteItemsStore.getItems(this.params.noteId));
    });
  }

  public dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  // TODO: remove these properties, use internal state to track pending changes instead of relying on NotePage to pass correct data for non-persisted items
  private readonly pendingRemovedIds = new Set<string>();
  private readonly pendingUpdatesMap = new Map<
    string,
    Partial<Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">>
  >();

  public getItemsSorted(): NoteItem[] {
    return [...this.items].sort(
      (first, second) => first.position - second.position,
    );
  }

  public getItemsSortedGroupedByParent(): ItemParentGroup[] {
    const sorted = this.getItemsSorted();

    const grouped: ItemParentGroup[] = [];
    let currentGroup: ItemParentGroup | null = null;
    for (const item of sorted) {
      if (item.is_child && currentGroup) {
        currentGroup.children.push(item);
      } else {
        currentGroup = { parent: item, children: [] };
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
        parent.completed_at &&
        children.every((child) => child.completed_at)
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

    return { checked, unchecked };
  }

  public getItems() {
    return this.items;
  }

  public setItems(items: NoteItem[]): void {
    // TODO: use normal comparison
    const itemsChanged = JSON.stringify(this.items) !== JSON.stringify(items);
    if (itemsChanged) {
      this.items = items;
    }

    if (itemsChanged) {
      this.params.onChange();
    }
  }

  public changeItemLocally(id: string, updates: Partial<NoteItem>): void {
    this.setItems(
      this.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  }

  public removeItemLocally(id: string): void {
    const itemToRemove = this.items.find((item) => item.id === id);

    if (!itemToRemove) {
      this.params.showError(`removeItem: item with id ${id} not found`);
      return;
    }

    this.setItems(this.items.filter((item) => item.id !== id));
  }

  public removeItemRemotely(id: string, persisted: boolean): void {
    if (!persisted) {
      // Item has NOT been persisted yet, add to list to remove after persistence
      this.pendingRemovedIds.add(id);
      return;
    }

    this.params.noteItemsTable.delete(id).catch((error) => {
      this.params.showError(error.message);
    });
  }

  public removeItem(id: string) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) {
      this.params.showError(`removeItem: item with id ${id} not found`);
      return;
    }

    this.removeItemLocally(id);
    this.removeItemRemotely(id, item.persisted);
  }

  public persistItem(
    id: string,
    updates: Partial<
      Pick<NoteItem, "title" | "position" | "completed_at" | "is_child">
    >,
  ): void {
    const itemToUpdate = this.items.find((item) => item.id === id);
    if (!itemToUpdate) {
      this.params.showError(`persistItem: item with id ${id} not found`);
      return;
    }

    const updated_at = new Date().toISOString();
    this.changeItemLocally(id, { updated_at, persisted: false });

    if (!itemToUpdate.persisted) {
      this.pendingUpdatesMap.set(id, {
        ...this.pendingUpdatesMap.get(id),
        ...updates,
      });
      return;
    }

    if (updates.completed_at === PENDING_COMPLETED_AT) {
      this.params.noteItemsTable
        .setCompleted(id, true)
        .then((result) => {
          const localItem = this.items.find((item) => item.id === id);
          if (localItem) {
            this.changeItemLocally(id, {
              completed_at: result.completed_at,
              updated_at: result.updated_at,
              persisted: true,
            });
          }
        })
        .catch((error) => {
          const itemStillExists = this.items.some((item) => item.id === id);
          this.params.showError(
            `persistItem(setCompleted): error id=[${id}] [${error.message}] itemStillExists=[${itemStillExists}]`,
          );
        });
      return;
    }

    this.params.noteItemsTable
      .update(id, updates)
      .then((result) => {
        // Check that local item has not been removed during update
        const localItem = this.items.find((item) => item.id === id);
        if (localItem) {
          this.changeItemLocally(id, {
            updated_at: result.updated_at,
            persisted: true,
          });
        }
      })
      .catch((error) => {
        const itemStillExists = this.items.some((item) => item.id === id);
        this.params.showError(
          `persistItem: error id=[${id}] [${error.message}] itemStillExists=[${itemStillExists}]`,
        );
      });
  }

  public setPendingFocus(focus: PendingFocus | null) {
    this.pendingFocus = focus;
    this.params.onChange();
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
    },
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
      this.params.showError(
        `moveItem: item not found on sourceIndex=[${sourceIndex}]`,
      );
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
        this.params.showError(
          `moveItem: no previousItem for dropIndex=[${dropIndex}]`,
        );
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
        persisted: false,
      });
      this.persistItem(item.id, { position, is_child });
    }
  }

  private shiftElementsToInsertOnPosition(position: number, count: number) {
    const shiftedItems = shiftItemsToInsertOnPosition(
      this.items,
      position,
      count,
    );

    shiftedItems.forEach((nextPosition, id) => {
      this.changeItemLocally(id, {
        position: nextPosition,
        persisted: false,
      });

      this.persistItem(id, { position: nextPosition });
    });
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
      created_at: "",
      updated_at: "",
      position,
      completed_at,
      persisted: false,
      is_child,
    };

    this.setItems([...this.items, newItem]);

    this.setPendingFocus({
      id: newItem.id,
      selectionStart: 0,
      selectionEnd: 0,
    });

    this.params.noteItemsTable
      .create(newItem)
      .then((data) => {
        // Item was deleted on the client
        if (this.pendingRemovedIds.delete(data.id)) {
          this.removeItemRemotely(data.id, true);
          return;
        }

        const pendingUpdate = this.pendingUpdatesMap.get(data.id);
        this.changeItemLocally(data.id, {
          created_at: data.created_at,
          updated_at: data.updated_at,
          persisted: !pendingUpdate,
        });
        if (pendingUpdate) {
          this.pendingUpdatesMap.delete(data.id);
          this.persistItem(data.id, pendingUpdate);
        }
      })
      .catch((error) => {
        this.params.showError(error.message);
      });
  }

  public getPositionAtTheEnd(): number {
    return Math.max(...this.items.map((item) => item.position), 0) + 1;
  }

  public createNewItemAtTheEnd() {
    const nextPosition = this.getPositionAtTheEnd();
    this.insertItem({
      title: "",
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
    const currentItem = this.items.find((item) => item.id === id);

    if (!currentItem) {
      this.params.showError(`createItemAfter: item not found id=[${id}]`);
      return;
    }

    const titlePrevious = currentItem.title.slice(0, selectionStart);
    const titleNew = currentItem.title.slice(selectionEnd);

    const previousParams = { title: titlePrevious };
    this.changeItemLocally(id, { ...previousParams, persisted: false });
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
      persisted: false,
    });

    if (!item.persisted) {
      this.persistItem(id, {
        completed_at: checked ? PENDING_COMPLETED_AT : null,
      });
    } else {
      this.params.noteItemsTable
        .setCompleted(id, checked)
        .then((result) => {
          const localItem = this.items.find((item) => item.id === id);
          if (localItem) {
            this.changeItemLocally(id, {
              completed_at: result.completed_at,
              updated_at: result.updated_at,
              persisted: true,
            });
          }
        })
        .catch((error) => {
          this.params.showError(
            `toggleChecked: error id=[${id}] [${error.message}]`,
          );
        });
    }

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
        this.params.showError(
          `toggleChecked: parent item not found for id=[${id}]`,
        );
        return;
      }

      this.persistItem(parentItem.id, {});
    }
  }

  public mergeItemWithPrevious(id: string) {
    const sortedItems = [...this.items].sort(
      (first, second) => first.position - second.position,
    );
    const currentIndex = sortedItems.findIndex((item) => item.id === id);

    if (currentIndex <= 0) {
      return;
    }

    const currentItem = sortedItems[currentIndex];
    const previousItem = sortedItems[currentIndex - 1];
    const mergedTitle = previousItem.title + currentItem.title;
    const cursorPosition = previousItem.title.length;

    this.setItems(
      this.items.map((item) => {
        if (item.id === previousItem.id) {
          return { ...item, title: mergedTitle };
        }

        return item;
      }),
    );

    this.persistItem(previousItem.id, { title: mergedTitle });
    this.removeItemLocally(currentItem.id);
    this.removeItemRemotely(currentItem.id, currentItem.persisted);
    this.setPendingFocus({
      id: previousItem.id,
      selectionStart: cursorPosition,
      selectionEnd: cursorPosition,
    });
  }
}
