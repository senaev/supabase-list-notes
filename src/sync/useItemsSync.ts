import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxDatabase, RxDocument } from "rxdb";
import type { RxSupabaseReplicationState } from "rxdb/plugins/replication-supabase";
import type { Subscription } from "rxjs";
import { createLocalDatabase, LocalCollections, LocalItemRow } from "./localDb";
import { startItemsReplication } from "./replication";
import type { EditableFields, Item } from "./types";

function toItem(row: LocalItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    checked_at: row.checked_at,
    created_at: row.created_at,
    _modified: row._modified,
  };
}

export interface UseItemsSyncResult {
  /** All non-deleted items, in no particular order - callers decide sorting. */
  items: Item[];
  error: string | null;
  /** Creates an item (title may be empty, e.g. to start editing immediately)
   * and returns its id synchronously for optimistic focus handling. The
   * item itself only appears in `items` once the local database write
   * completes (typically within a few ms). */
  addItem: (title: string) => string;
  updateItem: (id: string, patch: Partial<EditableFields>) => void;
  /** Soft-deletes the item (RxDB's `_deleted` tombstone) so Realtime
   * tombstones are reliably delivered to other tabs/devices. */
  removeItem: (id: string) => void;
}

/**
 * Local-first sync engine backed by RxDB (IndexedDB via the Dexie storage
 * adapter) instead of a hand-rolled localStorage mirror. RxDB's Supabase
 * replication plugin (rxdb/plugins/replication-supabase) handles pull,
 * push, and Realtime-driven live sync, including batching/coalescing
 * concurrent local writes to the same document - the same class of races
 * that previously had to be patched manually.
 *
 * `items` is driven directly by the local collection's reactive query: a
 * single source of truth, no secondary optimistic-cache layer on top of it.
 */
export function useItemsSync(client: SupabaseClient): UseItemsSyncResult {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const collectionRef = useRef<LocalCollections["items"] | null>(null);
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
  const docsRef = useRef<Map<string, RxDocument<LocalItemRow>>>(new Map());
  // Chains database lifecycles (create -> ... -> remove -> create -> ...)
  // strictly sequentially across effect re-runs; see the comment below.
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let db: RxDatabase<LocalCollections> | undefined;
    let replicationState: RxSupabaseReplicationState<LocalItemRow> | undefined;
    let querySubscription: Subscription | undefined;
    let errorSubscription: Subscription | undefined;

    // Chained onto the previous lifecycle's teardown (assigned in the
    // cleanup function below) so a new local database for a different
    // Supabase project is never created while the old one - which may
    // belong to a different project - is still being torn down. Without
    // this, one project's items could briefly coexist with, or even get
    // pushed to, another project's backend.
    const initPromise = lifecycleRef.current.then(async () => {
      if (cancelled) {
        return;
      }

      try {
        db = await createLocalDatabase();
      } catch (initError) {
        // Without this catch, a failure here (e.g. a local IndexedDB schema
        // mismatch from a previous version of itemsSchema) would leave
        // collectionRef.current permanently null with zero feedback: every
        // addItem/updateItem/removeItem call would then silently no-op.
        console.error("Failed to open local database:", initError);
        if (!cancelled) {
          setError(initError instanceof Error ? initError.message : "Failed to open local database");
        }
        return;
      }

      if (cancelled) {
        await db.remove();
        db = undefined;
        return;
      }

      collectionRef.current = db.items;

      querySubscription = db.items.find().$.subscribe((docs) => {
        docsRef.current = new Map(docs.map((doc) => [doc.primary, doc]));
        setItems(docs.map((doc) => toItem(doc.toMutableJSON())));
      });

      try {
        replicationState = startItemsReplication({ client, collection: db.items });
      } catch (replicationInitError) {
        console.error("Failed to start replication:", replicationInitError);
        setError(
          replicationInitError instanceof Error
            ? replicationInitError.message
            : "Failed to start replication",
        );
        return;
      }

      errorSubscription = replicationState.error$.subscribe((replicationError) => {
        console.error("Replication error:", replicationError);
        setError(replicationError.message);
      });
    });

    lifecycleRef.current = initPromise.catch(() => undefined);

    return () => {
      cancelled = true;
      collectionRef.current = null;
      docsRef.current = new Map();

      lifecycleRef.current = initPromise
        .catch(() => undefined)
        .then(async () => {
          querySubscription?.unsubscribe();
          errorSubscription?.unsubscribe();
          if (replicationState) {
            await replicationState.remove().catch(() => undefined);
          }
          if (db) {
            await db.remove().catch(() => undefined);
          }
        });
    };
  }, [client]);

  const addItem = useCallback((title: string): string => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalItemRow = {
      id,
      title,
      type: null,
      checked_at: null,
      created_at: now,
      _modified: now,
      _deleted: false,
    };

    collectionRef.current
      ?.insert(row)
      .then((doc) => {
        // Cache the freshly-inserted doc immediately, before the reactive
        // query even re-emits, so an updateItem() call fired right after
        // addItem() (e.g. typing into a just-created item) doesn't fall
        // through to the findOne() fallback below.
        docsRef.current.set(id, doc);
      })
      .catch((insertError: Error) => setError(insertError.message));

    return id;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<EditableFields>) => {
    const cachedDoc = docsRef.current.get(id);
    if (cachedDoc) {
      // Synchronous dispatch: see the docsRef comment above for why this
      // matters for correctly ordering fast, consecutive edits.
      cachedDoc
        .incrementalPatch({ ...patch, _modified: new Date().toISOString() })
        .catch((updateError: Error) => setError(updateError.message));
      return;
    }

    // Fallback for the narrow window before a doc has been cached at all
    // (e.g. updateItem racing addItem's own insert promise). Order isn't
    // at risk here since there's nothing yet to race against.
    const collection = collectionRef.current;
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
        docsRef.current.set(id, doc);
        return doc.incrementalPatch({ ...patch, _modified: new Date().toISOString() });
      })
      .catch((updateError: Error) => setError(updateError.message));
  }, []);

  const removeItem = useCallback((id: string) => {
    const cachedDoc = docsRef.current.get(id);
    if (cachedDoc) {
      docsRef.current.delete(id);
      cachedDoc.remove().catch((removeError: Error) => setError(removeError.message));
      return;
    }

    const collection = collectionRef.current;
    if (!collection) {
      return;
    }

    collection
      .findOne(id)
      .exec()
      .then((doc) => doc?.remove())
      .catch((removeError: Error) => setError(removeError.message));
  }, []);

  return { items, error, addItem, updateItem, removeItem };
}
