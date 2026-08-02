import type { SupabaseClient } from '@supabase/supabase-js';
import type { RxDatabase, RxDocument } from 'rxdb';
import type { RxSupabaseReplicationState } from 'rxdb/plugins/replication-supabase';
import type { Subscription } from 'rxjs';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { combineSignalsIntoNewOne } from 'senaev-utils/src/utils/Signal/combineSignalsIntoNewOne/combineSignalsIntoNewOne';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';
import { DEFAULT_ITEM_TYPE } from '../const/DEFAULT_ITEM_TYPE';
import { createLocalDatabase, LocalCollections, LocalItemRow } from './localDb';
import { startItemsReplication } from './replication';
import type { EditableFields, Item, NetworkSyncStatus } from './types';

function toItem(row: LocalItemRow): Item {
    return {
        id: row.id,
        title: row.title,
        // Defensive fallback: `type` is typed as `string` (non-null) end to
        // end, but a row pulled from Supabase before the "require item type"
        // migration (see schema.sql) has run against that project's table can
        // still come back with `type: null` at runtime despite the TS type,
        // since the replication pull isn't schema-validated.
        type: row.type ?? DEFAULT_ITEM_TYPE,
        checked_at: row.checked_at,
        created_at: row.created_at,
        _modified: row._modified,
    };
}

type PendingOptimisticCreate = {
    item: Item;
    // Always settles (resolves), never rejects - see addItem - so callers
    // (removeItem) can await it without needing their own error handling.
    writePromise: Promise<void>;
};

/**
 * Local-first sync engine backed by RxDB (IndexedDB via the Dexie storage
 * adapter) instead of a hand-rolled localStorage mirror. RxDB's Supabase
 * replication plugin (rxdb/plugins/replication-supabase) handles pull,
 * push, and Realtime-driven live sync.
 *
 * Plain, framework-agnostic class - React only touches it through
 * `itemsSignal`/`errorSignal` (see useItemsSync's `useSignal` wiring) and
 * the addItem/updateItem/removeItem methods.
 *
 * `itemsSignal` is driven by the local collection's reactive query, plus a
 * thin optimistic-overlay reconciliation on top (ported from the reference
 * NoteItemsStore design) for two cases the raw query can't cover by itself:
 * - A just-created item needs to appear immediately, before its insert has
 *   actually landed in the local database (pendingOptimisticCreatesById).
 * - A just-removed item needs to disappear immediately, and incoming query
 *   emissions racing the removal shouldn't be able to briefly resurrect it
 *   (pendingOptimisticDeleteIds).
 */
export class ItemsSyncStore {
    public readonly itemsSignal = new Signal<Item[]>([], deepEqual);
    public readonly errorSignal = new Signal<string | null>(null);

    // --- Network/sync status (see MainPageHeader's logo badge) ---
    // Browser-level connectivity - the primary signal, since it fires even
    // during an idle offline period with no replication activity at all to
    // observe.
    private readonly isOnlineSignal = new Signal<boolean>(
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );
    // True whenever replication's pull/push handler is stuck in its retry
    // loop after an error (e.g. Supabase itself unreachable, RLS/schema
    // errors). RxDB's replication primitives never let `active$` go false
    // while stuck retrying, so this only ever gets cleared once a cycle
    // completes successfully (see the active$ subscription in init()).
    private readonly hasReplicationErrorSignal = new Signal<boolean>(false);
    // Direct mirror of replicationState.active$.
    private readonly isSyncingSignal = new Signal<boolean>(false);

    /** offline > syncing > synced - see NetworkSyncStatus. */
    public readonly networkSyncStatusSignal: Signal<NetworkSyncStatus>;

    private readonly boundHandleOnline = (): void => this.isOnlineSignal.next(true);
    private readonly boundHandleOffline = (): void => this.isOnlineSignal.next(false);

    private readonly pendingOptimisticCreatesById = new Map<string, PendingOptimisticCreate>();
    private pendingOptimisticDeleteIds = new Set<string>();

    private collection: LocalCollections['items'] | null = null;
    // Live RxDocument instances keyed by id, refreshed on every query emission
    // and eagerly on insert (see addItem). updateItem/removeItem call
    // `.incrementalPatch()`/`.remove()` on these *synchronously* instead of
    // going through an extra `findOne(id).exec()` per call: RxDB's internal
    // incremental write queue serializes writes to the same RxDocument in the
    // order they're *called*, not the order some intermediate promise happens
    // to resolve in. Without this, two `findOne(id).exec()` calls for two
    // fast keystrokes can resolve out of order, so the older keystroke's
    // patch gets queued *after* the newer one and silently reverts it - and
    // that, in turn, is what can make a stale replication echo of an old
    // local write look "newer" than the local fork and win against it.
    private readonly docs = new Map<string, RxDocument<LocalItemRow>>();

    private db?: RxDatabase<LocalCollections>;
    private replicationState?: RxSupabaseReplicationState<LocalItemRow>;
    private querySubscription?: Subscription;
    private errorSubscription?: Subscription;
    private activeSubscription?: Subscription;

    // Chains lifecycles (create -> ... -> remove -> create -> ...) strictly
    // sequentially across setClient()/dispose() calls; see teardown() below.
    private lifecycle: Promise<void> = Promise.resolve();
    // Invalidates any in-flight init() started by a since-superseded
    // setClient() call (e.g. rapid project switches, or React StrictMode's
    // mount/unmount/mount double-invoke in development).
    private generation = 0;

    public constructor() {
        this.networkSyncStatusSignal = combineSignalsIntoNewOne(
            [this.isOnlineSignal, this.hasReplicationErrorSignal, this.isSyncingSignal],
            (isOnline, hasReplicationError, isSyncing): NetworkSyncStatus => {
                if (!isOnline || hasReplicationError) {
                    return 'offline';
                }
                return isSyncing ? 'syncing' : 'synced';
            },
        ).signal;

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.boundHandleOnline);
            window.addEventListener('offline', this.boundHandleOffline);
        }
    }

    /**
     * (Re)points replication + the local database at the given Supabase
     * client. Safe to call repeatedly (e.g. when the signed-in project
     * changes): the previous database is always fully torn down before a new
     * one is created, so one project's items can never leak into another
     * project's local storage or get pushed to the wrong backend.
     */
    public setClient(client: SupabaseClient): void {
        const generation = ++this.generation;
        this.lifecycle = this.teardown().then(() => this.init(client, generation));
    }

    /** Final teardown - call when the owning component unmounts. */
    public dispose(): void {
        this.generation++;
        this.lifecycle = this.teardown();

        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.boundHandleOnline);
            window.removeEventListener('offline', this.boundHandleOffline);
        }
    }

    private async teardown(): Promise<void> {
        await this.lifecycle.catch(() => undefined);

        this.collection = null;
        this.docs.clear();
        this.pendingOptimisticCreatesById.clear();
        this.pendingOptimisticDeleteIds.clear();

        this.querySubscription?.unsubscribe();
        this.errorSubscription?.unsubscribe();
        this.activeSubscription?.unsubscribe();
        this.querySubscription = undefined;
        this.errorSubscription = undefined;
        this.activeSubscription = undefined;

        // Reset rather than leave stale: the previous client's replication no
        // longer applies (isOnlineSignal is untouched - it's browser-level, not
        // per-client).
        this.hasReplicationErrorSignal.next(false);
        this.isSyncingSignal.next(false);

        if (this.replicationState) {
            await this.replicationState.remove().catch(() => undefined);
            this.replicationState = undefined;
        }

        if (this.db) {
            await this.db.remove().catch(() => undefined);
            this.db = undefined;
        }
    }

    private async init(client: SupabaseClient, generation: number): Promise<void> {
        if (generation !== this.generation) {
            return;
        }

        let db: RxDatabase<LocalCollections>;
        try {
            db = await createLocalDatabase();
        } catch (initError) {
            // Without this catch, a failure here (e.g. a local IndexedDB schema
            // mismatch from a previous version of itemsSchema) would leave
            // `collection` permanently null with zero feedback: every
            // addItem/updateItem/removeItem call would then silently no-op.
            console.error('Failed to open local database:', initError);
            if (generation === this.generation) {
                this.errorSignal.next(
                    initError instanceof Error
                        ? initError.message
                        : 'Failed to open local database',
                );
            }
            return;
        }

        if (generation !== this.generation) {
            await db.remove().catch(() => undefined);
            return;
        }

        this.db = db;
        this.collection = db.items;

        this.querySubscription = db.items.find().$.subscribe((docs) => {
            this.docs.clear();
            docs.forEach((doc) => {
                this.docs.set(doc.primary, doc);
            });

            const allIncomingItems = docs.map((doc) => toItem(doc.toMutableJSON()));
            const incomingIds = new Set(allIncomingItems.map((item) => item.id));
            const incomingItems = allIncomingItems.filter(
                (item) => !this.pendingOptimisticDeleteIds.has(item.id),
            );

            // Drop delete-tombstone tracking once the query confirms the item is
            // actually gone, so a later item reusing the same id (can't happen
            // with UUIDs, but keeps the set from growing unbounded regardless)
            // isn't permanently filtered out.
            this.pendingOptimisticDeleteIds =
                this.pendingOptimisticDeleteIds.intersection(incomingIds);

            const currentById = new Map(this.itemsSignal.value().map((item) => [item.id, item]));

            const nextItems = incomingItems.map((incomingItem) => {
                // The query has now confirmed this item exists, so it's no longer
                // "pending" even if the optimistic version stays displayed below.
                this.pendingOptimisticCreatesById.delete(incomingItem.id);

                const currentItem = currentById.get(incomingItem.id);

                // Guard against a stale/slow emission clobbering a newer local
                // edit with an older one (e.g. a delayed pull racing a fresh
                // local write for the same item).
                if (
                    currentItem &&
                    Date.parse(currentItem._modified) > Date.parse(incomingItem._modified)
                ) {
                    return currentItem;
                }

                return incomingItem;
            });

            for (const pendingOptimisticCreate of this.pendingOptimisticCreatesById.values()) {
                nextItems.push(pendingOptimisticCreate.item);
            }

            this.itemsSignal.next(nextItems);
        });

        let replicationState: RxSupabaseReplicationState<LocalItemRow>;
        try {
            replicationState = startItemsReplication({ client, collection: db.items });
        } catch (replicationInitError) {
            console.error('Failed to start replication:', replicationInitError);
            this.errorSignal.next(
                replicationInitError instanceof Error
                    ? replicationInitError.message
                    : 'Failed to start replication',
            );
            return;
        }

        this.replicationState = replicationState;

        this.errorSubscription = replicationState.error$.subscribe((replicationError) => {
            // Deliberately console-only, not errorSignal (the modal, see
            // NotePage.tsx/Toasts.tsx): RxDB retries a failing pull/push
            // indefinitely and reports every single attempt here, so a flaky or
            // dropped connection would otherwise spam the user with a wall of
            // raw RxDB error dumps. The header's badge (see
            // networkSyncStatusSignal below) already tells them sync isn't
            // going through - a technical error dump on top of that isn't
            // actionable for them, only for us.
            console.error('Replication error:', replicationError);
            this.hasReplicationErrorSignal.next(true);
        });

        this.activeSubscription = replicationState.active$.subscribe((isActive) => {
            if (!isActive) {
                // `active$` only ever goes false once a cycle completes without
                // getting stuck in the retry loop above, so this is the one place
                // it's safe to clear a previously-flagged error.
                this.hasReplicationErrorSignal.next(false);
            }

            this.isSyncingSignal.next(isActive);
        });
    }

    /**
     * Creates an item (title may be empty, e.g. to start editing immediately)
     * and returns its id synchronously for optimistic focus handling. The
     * item is immediately reflected in `itemsSignal` (see
     * pendingOptimisticCreatesById) rather than waiting for the local
     * database write to complete.
     *
     * `type` defaults to DEFAULT_ITEM_TYPE client-side (the DB column is
     * `not null` with no DB-level default - see schema.sql). Callers that
     * split an existing item into two (see NotePage's createItemAfter) pass
     * the original item's `type` through so the new item copies its type
     * instead of falling back to the default.
     */
    public addItem = (title: string, type: string = DEFAULT_ITEM_TYPE): string => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const row: LocalItemRow = {
            id,
            title,
            type,
            checked_at: null,
            created_at: now,
            _modified: now,
            _deleted: false,
        };

        const optimisticItem = toItem(row);

        // Always settles (never rejects): on failure it surfaces the error and
        // rolls back the optimistic entry itself, so callers (removeItem) can
        // just await it without their own error handling.
        const writePromise: Promise<void> = this.collection
            ? this.collection.insert(row).then(
                  (doc) => {
                      // Cache the freshly-inserted doc immediately, before the
                      // reactive query even re-emits, so an updateItem() call fired
                      // right after addItem() (e.g. typing into a just-created item)
                      // doesn't fall through to the findOne() fallback there.
                      this.docs.set(id, doc);
                  },
                  (insertError: Error) => {
                      this.errorSignal.next(insertError.message);
                      this.removeOptimisticItem(id);
                  },
              )
            : Promise.resolve().then(() => {
                  this.errorSignal.next('Local database is not ready yet');
                  this.removeOptimisticItem(id);
              });

        this.pendingOptimisticCreatesById.set(id, { item: optimisticItem, writePromise });

        this.itemsSignal.next([...this.itemsSignal.value(), optimisticItem]);

        return id;
    };

    public updateItem = (id: string, patch: Partial<EditableFields>): void => {
        const cachedDoc = this.docs.get(id);
        if (cachedDoc) {
            // Synchronous dispatch: see the `docs` field comment above for why
            // this matters for correctly ordering fast, consecutive edits.
            cachedDoc
                .incrementalPatch({ ...patch, _modified: new Date().toISOString() })
                .catch((updateError: Error) => this.errorSignal.next(updateError.message));
            return;
        }

        // Fallback for the narrow window before a doc has been cached at all
        // (e.g. updateItem racing addItem's own insert promise). Order isn't
        // at risk here since there's nothing yet to race against.
        const collection = this.collection;
        if (!collection) {
            return;
        }

        collection
            .findOne(id)
            .exec()
            .then((doc) => {
                if (!doc) {
                    return undefined;
                }
                this.docs.set(id, doc);
                return doc.incrementalPatch({ ...patch, _modified: new Date().toISOString() });
            })
            .catch((updateError: Error) => this.errorSignal.next(updateError.message));
    };

    /**
     * Soft-deletes the item (RxDB's `_deleted` tombstone) so Realtime
     * tombstones are reliably delivered to other tabs/devices.
     */
    public removeItem = (id: string): void => {
        const pendingOptimisticCreate = this.pendingOptimisticCreatesById.get(id);

        this.removeOptimisticItem(id);

        if (pendingOptimisticCreate) {
            // Wait for the item's own insert to land before removing it, so the
            // remove can never race ahead of (and effectively no-op against) a
            // create that hasn't been written yet.
            pendingOptimisticCreate.writePromise.then(this.removeFromStorage(id));
            return;
        }

        this.removeFromStorage(id)();
    };

    private removeOptimisticItem(id: string): void {
        this.pendingOptimisticCreatesById.delete(id);
        this.pendingOptimisticDeleteIds.add(id);
        this.itemsSignal.next(this.itemsSignal.value().filter((item) => item.id !== id));
    }

    private removeFromStorage(id: string): VoidFunction {
        return () => {
            const cachedDoc = this.docs.get(id);
            if (cachedDoc) {
                this.docs.delete(id);
                cachedDoc
                    .remove()
                    .catch((removeError: Error) => this.errorSignal.next(removeError.message));
                return;
            }

            const collection = this.collection;
            if (!collection) {
                return;
            }

            collection
                .findOne(id)
                .exec()
                .then((doc) => doc?.remove())
                .catch((removeError: Error) => this.errorSignal.next(removeError.message));
        };
    }
}
