import { expect, test } from '@playwright/test';

test('typing fast into a note item keeps the caret in place and loses no keystrokes', async ({
    page,
}) => {
    await page.goto('/');

    await page.locator('.NotePage__addItemButton').click();

    // Scoped to .NotePage__items (the unchecked-items container) so this
    // can't match a checked item instead - checked items render after the
    // add button as read-only rows with no <textarea>, which would hang
    // this test forever waiting for one that will never appear.
    const item = page.locator('.NotePage__items .NoteItemElement').last();
    const textarea = item.locator('textarea.NoteItemElement__input');

    await textarea.click();
    await textarea.pressSequentially('hello world', { delay: 5 });
    await textarea.pressSequentially(' typing test', { delay: 0 });

    await expect(textarea).toHaveValue('hello world typing test');

    await textarea.evaluate((element: HTMLTextAreaElement) => {
        element.setSelectionRange(5, 5);
    });
    await page.waitForTimeout(300);

    const selectionStart = await textarea.evaluate(
        (element: HTMLTextAreaElement) => element.selectionStart
    );

    expect(selectionStart).toBe(5);

    await item.locator('.NoteItemElement__remove').click();
});
