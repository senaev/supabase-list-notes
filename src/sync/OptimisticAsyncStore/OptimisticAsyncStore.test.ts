import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticAsyncStore, StoreItemInternalParams } from './OptimisticAsyncStore';

type TestRow = StoreItemInternalParams & {
    title: string;
};

const T0 = '2024-01-01T00:00:00.000Z';
const T1 = '2024-01-01T00:00:01.000Z';

function uuid(index: number) {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` as ReturnType<
        Crypto['randomUUID']
    >;
}

/** A row as the remote reports it, with the internal fields the store compares on. */
function row(id: string, overrides: Partial<TestRow> = {}): TestRow {
    return {
        id,
        title: 'remote title',
        created_at: T0,
        modified_at: T0,
        update_index: 0,
        _deleted: false,
        ...overrides,
    };
}

function createRemoteStorage() {
    return {
        items: new Signal<TestRow[]>([]),
        put: vi.fn(async (_item: TestRow) => {}),
    };
}

describe('OptimisticAsyncStore', () => {
    let remoteStorage: ReturnType<typeof createRemoteStorage>;
    let store: OptimisticAsyncStore<TestRow>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(T0));

        let uuidIndex = 0;

        vi.spyOn(crypto, 'randomUUID').mockImplementation(() => uuid(++uuidIndex));

        remoteStorage = createRemoteStorage();
        store = new OptimisticAsyncStore(remoteStorage);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('shows a created item at once and does not duplicate it when the remote echoes it', () => {
        const { id } = store.createItem({ title: 'first' });

        expect(store.items.getValue()).toEqual([row(uuid(1), { title: 'first' })]);

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        expect(store.items.getValue()).toEqual([row(id, { title: 'first' })]);
    });

    it('shows an item that only ever came from the remote', () => {
        remoteStorage.items.dispatch([row('remote-only', { title: 'from another device' })]);

        expect(store.items.getValue()).toEqual([
            row('remote-only', { title: 'from another device' }),
        ]);
    });

    it('keeps a local edit when the remote echoes the row from before that edit', async () => {
        const { id } = store.createItem({ title: 'first' });

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        vi.setSystemTime(new Date(T1));
        await store.updateItem(id, { title: 'edited here' });

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        expect(store.items.getValue()).toEqual([
            row(id, {
                title: 'edited here',
                modified_at: T1,
                update_index: 1,
            }),
        ]);
    });

    it('takes the remote row when it is newer than the local edit', async () => {
        const { id } = store.createItem({ title: 'first' });

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        vi.setSystemTime(new Date(T1));
        await store.updateItem(id, { title: 'edited here' });

        const newerRemoteRow = row(id, {
            title: 'edited elsewhere',
            modified_at: T1,
            update_index: 2,
        });

        remoteStorage.items.dispatch([newerRemoteRow]);

        expect(store.items.getValue()).toEqual([newerRemoteRow]);
    });

    it('hides a deleted item until the remote stops reporting it', async () => {
        const { id } = store.createItem({ title: 'first' });

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        vi.setSystemTime(new Date(T1));
        await store.deleteItem(id);

        expect(store.items.getValue()).toEqual([]);
        expect(remoteStorage.put).toHaveBeenLastCalledWith(
            row(id, {
                title: 'first',
                modified_at: T1,
                update_index: 1,
                _deleted: true,
            })
        );

        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        expect(store.items.getValue()).toEqual([]);

        // Once the remote drops the id, the local suppression is released.
        remoteStorage.items.dispatch([]);
        remoteStorage.items.dispatch([row(id, { title: 'first' })]);

        expect(store.items.getValue()).toEqual([row(id, { title: 'first' })]);
    });

    it('waits for an in-flight create write before it writes the tombstone', async () => {
        let finishCreateWrite = () => {};

        remoteStorage.put.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishCreateWrite = resolve;
                })
        );

        const { id } = store.createItem({ title: 'first' });
        const deletion = store.deleteItem(id);

        expect(store.items.getValue()).toEqual([]);
        expect(remoteStorage.put).toHaveBeenCalledTimes(1);

        finishCreateWrite();
        await deletion;

        expect(remoteStorage.put).toHaveBeenCalledTimes(2);
        expect(remoteStorage.put).toHaveBeenLastCalledWith(
            row(id, {
                title: 'first',
                update_index: 1,
                _deleted: true,
            })
        );
    });
});
