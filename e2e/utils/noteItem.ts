import { expect, Locator, Page } from '@playwright/test';

import { expectRemoteRowDeleted } from './expectRemoteRowDeleted';

const TYPE_PILL_SELECTOR = '[aria-label^="Change type, currently "]';

/**
 * The textarea of an unchecked item. A checked item renders its title as
 * plain text instead, so this matches nothing while an item is checked.
 */
export function noteItemInput(page: Page, itemId: string): Locator {
    return page.locator(`#input-${itemId}`);
}

export function noteItemById(page: Page, itemId: string): Locator {
    return page.locator('.NoteItemElement', { has: noteItemInput(page, itemId) });
}

/**
 * Locates an item by its type pill instead of by its textarea, which keeps
 * working while the item is checked and while its title is being edited.
 * Only useful with a type that the test itself made unique.
 */
export function noteItemByType(page: Page, type: string): Locator {
    return page.locator('.NoteItemElement', {
        has: page.locator(`[aria-label="Change type, currently ${type}"]`),
    });
}

/**
 * Adds an item, focuses it and returns its id along with an id-scoped
 * locator for its textarea - preferred over an "«last item» in the list"
 * locator, which drifts as soon as sorting or another item changes.
 */
export async function addNoteItem(page: Page): Promise<{ itemId: string; input: Locator }> {
    await page.locator('.NotePage__addItemButton').click();

    // Scoped to .NotePage__items (the unchecked-items container) so this
    // can't match a checked item instead - checked items render after the
    // add button as read-only rows with no <textarea>, which would hang
    // the caller forever waiting for one that will never appear.
    const newItemInput = page
        .locator('.NotePage__items .NoteItemElement')
        .last()
        .locator('textarea.NoteItemElement__input');

    await newItemInput.click();

    const inputId = await newItemInput.getAttribute('id');

    expect(inputId, 'a newly added item should render a textarea with an id').toBeTruthy();

    const itemId = (inputId as string).replace('input-', '');

    return { itemId, input: noteItemInput(page, itemId) };
}

/**
 * Changes an item's type to a type that does not exist yet, via the picker's
 * "+ Create new" prompt. Picking an existing type instead would depend on
 * whatever types the shared test project happens to contain.
 */
export async function createNoteItemType(
    page: Page,
    item: Locator,
    newType: string
): Promise<void> {
    page.once('dialog', (dialog) => {
        void dialog.accept(newType);
    });

    await item.locator(TYPE_PILL_SELECTOR).click();
    await page.getByRole('menuitem', { name: '+ Create new' }).click();
}

/**
 * Removes an item and waits for the delete to reach Supabase, so the row is
 * not left behind in the shared test project.
 *
 * The click is forced because a neighbouring item can overlap the remove
 * button once the list is long.
 */
export async function removeNoteItem(page: Page, itemId: string): Promise<void> {
    await noteItemById(page, itemId).locator('.NoteItemElement__remove').click({ force: true });
    await expect(noteItemInput(page, itemId)).toHaveCount(0);
    await expectRemoteRowDeleted(itemId);
}
