import { expect, Locator, Page, test } from '@playwright/test';

import { expectRemoteRowDeleted } from './utils/expectRemoteRowDeleted';
import { addNoteItem, noteItemInput, removeNoteItem } from './utils/noteItem';

const LONG_TEXT =
    'a really long note title that has to wrap onto several lines instead of being cut off after the first one, however wide the window happens to be';

/**
 * These tests locate rows by their title, so every run needs its own titles.
 * The shared project can still hold a row left behind by an interrupted run,
 * and a repeated title would make those locators match several rows.
 */
function longTitle(): string {
    return `${LONG_TEXT} ${Date.now()}`;
}

/** No spaces anywhere, so it only fits by breaking mid-word. */
function unbreakableTitle(): string {
    return `${'x'.repeat(160)}${Date.now()}`;
}

type TextOverflow = {
    visibleLines: number;
    clippedLines: number;
    clippedPixelsRight: number;
};

function measureText(locator: Locator): Promise<TextOverflow> {
    return locator.evaluate((element) => {
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight);

        return {
            visibleLines: Math.round(element.clientHeight / lineHeight),
            clippedLines: Math.round((element.scrollHeight - element.clientHeight) / lineHeight),
            clippedPixelsRight: element.scrollWidth - element.clientWidth,
        };
    });
}

async function expectNothingClipped(locator: Locator): Promise<void> {
    await expect
        .poll(
            async () => {
                const { clippedLines, clippedPixelsRight } = await measureText(locator);

                return { clippedLines, clippedPixelsRight };
            },
            { message: 'the whole title should be visible, not cut off' }
        )
        .toEqual({ clippedLines: 0, clippedPixelsRight: 0 });
}

/**
 * A checked item renders its title as a plain div, so it can no longer be
 * found by its textarea id. Its checkbox label still carries the title,
 * which these tests make unique.
 */
function checkedNoteItem(page: Page, title: string): Locator {
    return page.locator('.NoteItemElement', {
        has: page.getByLabel(`Mark ${title} as checked`),
    });
}

/** The read-only title of a checked item - a div, never the textarea. */
function checkedNoteItemText(page: Page, title: string): Locator {
    return checkedNoteItem(page, title).locator('.NoteItemElement__input');
}

/**
 * Deliberately not .check(): ticking the box re-renders the row as read-only,
 * so a locator scoped to the row's textarea stops matching before .check()
 * can read back the new state, and it retries until the test times out.
 */
async function checkNoteItem(page: Page, itemId: string, title: string): Promise<void> {
    const checkbox = page.getByLabel(`Mark ${title} as checked`);

    await checkbox.click();

    await expect(checkbox).toBeChecked();
    await expect(noteItemInput(page, itemId)).toHaveCount(0);
}

/** removeNoteItem() locates the row by its textarea, which a checked row has not got. */
async function removeCheckedNoteItem(page: Page, itemId: string, title: string): Promise<void> {
    await checkedNoteItem(page, title).locator('.NoteItemElement__remove').click({ force: true });
    await expect(checkedNoteItem(page, title)).toHaveCount(0);
    await expectRemoteRowDeleted(itemId);
}

test('a long title wraps onto several lines while being edited', async ({ page }) => {
    await page.goto('/');

    const title = longTitle();
    const { itemId, input } = await addNoteItem(page);

    await input.fill(title);

    await expectNothingClipped(input);

    const { visibleLines } = await measureText(input);

    expect(visibleLines, 'the textarea should grow past a single row').toBeGreaterThan(1);

    await removeNoteItem(page, itemId);
});

test('a long title stays fully visible once the item is checked', async ({ page }) => {
    await page.goto('/');

    const title = longTitle();
    const { itemId, input } = await addNoteItem(page);

    await input.fill(title);
    await checkNoteItem(page, itemId, title);

    const text = checkedNoteItemText(page, title);

    await expectNothingClipped(text);

    const { visibleLines } = await measureText(text);

    expect(visibleLines, 'the read-only title should occupy several lines').toBeGreaterThan(1);

    await removeCheckedNoteItem(page, itemId, title);
});

test('a title with no spaces breaks mid-word instead of overflowing the row', async ({ page }) => {
    await page.goto('/');

    const title = unbreakableTitle();
    const { itemId, input } = await addNoteItem(page);

    await input.fill(title);

    await expectNothingClipped(input);

    await checkNoteItem(page, itemId, title);
    await expectNothingClipped(checkedNoteItemText(page, title));

    await removeCheckedNoteItem(page, itemId, title);
});
