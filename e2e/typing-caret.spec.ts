import { expect, test } from '@playwright/test';

import { addNoteItem, removeNoteItem } from './utils/noteItem';

test('typing fast into a note item keeps the caret in place and loses no keystrokes', async ({
    page,
}) => {
    await page.goto('/');

    const { itemId, input } = await addNoteItem(page);

    await input.pressSequentially('hello world', { delay: 5 });
    await input.pressSequentially(' typing test', { delay: 0 });

    await expect(input).toHaveValue('hello world typing test');

    await input.evaluate((element: HTMLTextAreaElement) => {
        element.setSelectionRange(5, 5);
    });
    await page.waitForTimeout(300);

    const selectionStart = await input.evaluate(
        (element: HTMLTextAreaElement) => element.selectionStart
    );

    expect(selectionStart).toBe(5);

    await removeNoteItem(page, itemId);
});
