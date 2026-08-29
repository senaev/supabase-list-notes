import { expect, test } from '@playwright/test';

test('auto-logs in via .env credentials and loads the main page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
});
