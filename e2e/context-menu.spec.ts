import { expect, Locator, Page, test } from '@playwright/test';

import { NBSP } from '../src/const/NBSP';

const SHARE_ITEM_NAME = `Share${NBSP}access`;

function contextMenuTrigger(page: Page): Locator {
    return page.getByRole('button', { name: 'Open menu' });
}

/**
 * Scoped to the header because the item type picker renders a `menu` role
 * too, so an unscoped lookup would go ambiguous as soon as a picker opens.
 */
function contextMenu(page: Page): Locator {
    return page.locator('header').getByRole('menu');
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // The loading header renders the same trigger with an empty menu, and it
    // is replaced once the Supabase client is ready. Waiting for a NotePage
    // element is what guarantees the clicks below land on the final header.
    await expect(page.locator('.NotePage__addItemButton')).toBeVisible();
});

test('opens the menu on a click', async ({ page }) => {
    const trigger = contextMenuTrigger(page);

    await expect(contextMenu(page)).toBeHidden();

    await trigger.click();

    await expect(contextMenu(page)).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

test('closes the menu on a second click', async ({ page }) => {
    const trigger = contextMenuTrigger(page);

    await trigger.click();
    await expect(contextMenu(page)).toBeVisible();

    await trigger.click();

    await expect(contextMenu(page)).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('closes the menu when focus leaves it', async ({ page }) => {
    const trigger = contextMenuTrigger(page);

    await trigger.click();
    await expect(contextMenu(page)).toBeVisible();

    // Shift+Tab moves focus out without any pointer event, so this covers the
    // blur path rather than the outside-click one.
    await page.keyboard.press('Shift+Tab');

    await expect(contextMenu(page)).toBeHidden();
    await expect(trigger).not.toBeFocused();
});

test('runs the selected item and closes the menu', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await contextMenuTrigger(page).click();
    await contextMenu(page).getByRole('menuitem', { name: SHARE_ITEM_NAME }).click();

    await expect(contextMenu(page)).toBeHidden();
    await expect(
        page.getByRole('status').filter({ hasText: 'Share link copied to clipboard' })
    ).toBeVisible();

    const sharedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));

    expect(sharedUrl.searchParams.get('pu')).toBeTruthy();
    expect(sharedUrl.searchParams.get('pk')).toBeTruthy();
});
