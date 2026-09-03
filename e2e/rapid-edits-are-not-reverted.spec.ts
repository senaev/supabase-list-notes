import { expect, Page, test } from '@playwright/test';

import {
    addNoteItem,
    createNoteItemType,
    noteItemById,
    noteItemByType,
    removeNoteItem,
} from './utils/noteItem';
import { getRemoteItemById } from './utils/remoteItems';

type Snapshot = {
    title: string | null;
    checked: boolean | null;
    type: string | null;
};

type SamplerWindow = {
    __snapshots: Snapshot[];
    __samplerId: number;
    __readItem: (id: string) => Snapshot;
};

const SAMPLE_EVERY_MS = 25;

/**
 * Extra sampling time after Supabase already has the final row, to cover the
 * echo coming back down into the local database.
 */
const ECHO_GRACE_MS = 200;

function installItemReader(page: Page): Promise<void> {
    return page.evaluate(() => {
        (globalThis as unknown as SamplerWindow).__readItem = (id: string): Snapshot => {
            const textarea = document.getElementById(`input-${id}`);
            const element = textarea?.closest('.NoteItemElement') ?? null;
            const checkbox = element?.querySelector('.NoteItemElement__checkbox') ?? null;
            const pill = element?.querySelector('[aria-label^="Change type, currently "]') ?? null;

            return {
                title: textarea instanceof HTMLTextAreaElement ? textarea.value : null,
                checked: checkbox instanceof HTMLInputElement ? checkbox.checked : null,
                type:
                    pill?.getAttribute('aria-label')?.replace('Change type, currently ', '') ??
                    null,
            };
        };
    });
}

test('a burst of edits across several fields is never reverted by sync', async ({ page }) => {
    // Every run gets its own title and types so that a row left behind by an
    // earlier run can never make a locator or a remote lookup ambiguous.
    const uniqueSuffix = String(Date.now()).slice(-5);
    const firstText = `a${uniqueSuffix}`;
    const secondText = `b${uniqueSuffix}`;
    const finalTitle = `${firstText}${secondText}`;
    const finalType = `t2${uniqueSuffix}`;

    await page.goto('/');
    await installItemReader(page);

    const { itemId, input } = await addNoteItem(page);

    // Start sampling before the edits, so the watch covers the whole burst as
    // well as the sync traffic that follows it.
    await page.evaluate(
        ({ target, everyMs }) => {
            const scope = globalThis as unknown as SamplerWindow;

            scope.__snapshots = [];
            scope.__samplerId = window.setInterval(() => {
                scope.__snapshots.push(scope.__readItem(target));
            }, everyMs);
        },
        { target: itemId, everyMs: SAMPLE_EVERY_MS }
    );

    // A rapid, uninterrupted burst touching the type, the title and
    // checked_at, so several in-flight pushes overlap each other. The type
    // goes first only so that every later step has a stable locator.
    await createNoteItemType(page, noteItemById(page, itemId), finalType);

    const item = noteItemByType(page, finalType);

    await input.click();
    await input.pressSequentially(firstText, { delay: 0 });

    await item.locator('.NoteItemElement__checkbox').check();
    await item.locator('.NoteItemElement__checkbox').uncheck();

    await input.click();
    await input.press('End');
    await input.pressSequentially(secondText, { delay: 0 });

    const expected: Snapshot = { title: finalTitle, checked: false, type: finalType };

    // 1. Immediately, with no settling time at all.
    const immediate = await page.evaluate(
        (target) => (globalThis as unknown as SamplerWindow).__readItem(target),
        itemId
    );

    expect(immediate).toEqual(expected);

    // 2. The edits reached Supabase at all. Polling for this doubles as the
    // wait for sync to finish, so there is no arbitrary sleep, and it stops
    // the test passing vacuously if replication never ran at all.
    await expect
        .poll(async () => (await getRemoteItemById(itemId))?.title, {
            timeout: 10_000,
            intervals: [50, 50, 100, 100, 200],
        })
        .toBe(finalTitle);

    // 3. The echo of that push is applied a moment after the push itself, so
    // keep sampling briefly past convergence - this is the window in which a
    // late echo used to overwrite the newer local edit.
    await page.waitForTimeout(ECHO_GRACE_MS);

    // 4. Nothing was reverted at any point in between, so a revert that
    // appears and then self-heals between two assertions still fails.
    const snapshots = await page.evaluate(() => {
        const scope = globalThis as unknown as SamplerWindow;

        window.clearInterval(scope.__samplerId);

        return scope.__snapshots;
    });

    function isFinalState(snapshot: Snapshot): boolean {
        return (
            snapshot.title === expected.title &&
            snapshot.checked === expected.checked &&
            snapshot.type === expected.type
        );
    }

    // Anchor on the first sample showing the complete final state - before
    // that point the samples legitimately show edits still in progress.
    const firstFinalIndex = snapshots.findIndex(isFinalState);

    expect(firstFinalIndex, 'the UI never showed the final state at all').toBeGreaterThanOrEqual(0);

    const settled = snapshots.slice(firstFinalIndex);
    const deviations = settled.filter((snapshot) => !isFinalState(snapshot));

    expect(settled.length).toBeGreaterThan(0);
    expect(
        deviations.slice(0, 5),
        `${deviations.length}/${settled.length} samples after the last edit lost it`
    ).toEqual([]);

    // 5. Supabase still holds every edit once everything has settled. Checked
    // last rather than at the moment it first converged, so that a late push
    // of an older row overwriting the remote state is caught too.
    const remote = await getRemoteItemById(itemId);

    expect({
        title: remote?.title,
        type: remote?.type,
        checked_at: remote?.checked_at,
        _deleted: remote?._deleted,
    }).toEqual({
        title: finalTitle,
        type: finalType,
        checked_at: null,
        _deleted: false,
    });

    await removeNoteItem(page, itemId);
});
