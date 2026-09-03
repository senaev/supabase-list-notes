import { expect } from '@playwright/test';

import { getRemoteItemById } from './remoteItems';

/**
 * Waits until a test's own row is gone from Supabase.
 *
 * Removing an item only queues a soft-delete for replication, so a test that
 * ends as soon as the row disappears from the page tears the browser down
 * before that push goes out, and the row is left behind in the shared test
 * project forever.
 */
export async function expectRemoteRowDeleted(id: string): Promise<void> {
    await expect
        .poll(
            async () => {
                const row = await getRemoteItemById(id);

                // The row never reached Supabase at all, so there is nothing
                // left behind to wait for.
                if (row === undefined) {
                    return true;
                }

                return row._deleted;
            },
            {
                timeout: 10_000,
                intervals: [50, 50, 100, 100, 200],
            }
        )
        .toBe(true);
}
