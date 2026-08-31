import { expect, test } from '@playwright/test';

test('typing fast into a note item keeps the caret in place and loses no keystrokes', async ({
    page,
}) => {
    await page.goto('/');

    await page.locator('.NotePage__addItemButton').click();

    const item = page.locator('.NoteItemElement').last();
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
