import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxDatabase, RxDocument } from "rxdb";
import type { RxSupabaseReplicationState } from "rxdb/plugins/replication-supabase";
import type { Subscription } from "rxjs";
import { Signal } from "senaev-utils/src/utils/Signal/Signal";
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

/**
 * Local-first sync engine backed by RxDB (IndexedDB via the Dexie storage
 * adapter) instead of a hand-rolled localStorage mirror. RxDB's Supabase
 * replication plugin (rxdb/plugins/replication-supabase) handles pull,
 * push, and Realtime-driven live sync.
 *
 * Plain, framework-agnostic class - React only touches it through
 * `itemsSignal`/`errorSignal` (see useItemsSync's `useSignal` wiring) and
 * the addItem/updateItem/removeItem methods. `itemsSignal` is driven
 * directly by the local collection's reactive query: a single source of
 * truth, no secondary optimistic-cache layer on top of it.
 */
export class ItemsSyncStore {
  public readonly itemsSignal = new Signal<Item[]>([]);
  public readonly errorSignal = new Signal<string | null>(null);

  private collection: LocalCollections["items"] | null = null;
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

  // Chains lifecycles (create -> ... -> remove -> create -> ...) strictly
  // sequentially across setClient()/dispose() calls; see teardown() below.
  private lifecycle: Promise<void> = Promise.resolve();
  // Invalidates any in-flight init() started by a since-superseded
  // setClient() call (e.g. rapid project switches, or React StrictMode's
  // mount/unmount/mount double-invoke in development).
  private generation = 0;

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
  }

  private async teardown(): Promise<void> {
    await this.lifecycle.catch(() => undefined);

    this.collection = null;
    this.docs.clear();

    this.querySubscription?.unsubscribe();
    this.errorSubscription?.unsubscribe();
    this.querySubscription = undefined;
    this.errorSubscription = undefined;

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
      console.error("Failed to open local database:", initError);
      if (generation === this.generation) {
        this.errorSignal.next(initError instanceof Error ? initError.message : "Failed to open local database");
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
      this.itemsSignal.next(docs.map((doc) => toItem(doc.toMutableJSON())));
    });

    let replicationState: RxSupabaseReplicationState<LocalItemRow>;
    try {
      replicationState = startItemsReplication({ client, collection: db.items });
    } catch (replicationInitError) {
      console.error("Failed to start replication:", replicationInitError);
      this.errorSignal.next(
        replicationInitError instanceof Error
          ? replicationInitError.message
          : "Failed to start replication",
      );
      return;
    }

    this.replicationState = replicationState;

    this.errorSubscription = replicationState.error$.subscribe((replicationError) => {
      console.error("Replication error:", replicationError);
      this.errorSignal.next(replicationError.message);
    });
  }

  /**
   * Creates an item (title may be empty, e.g. to start editing immediately)
   * and returns its id synchronously for optimistic focus handling. The
   * item itself only appears in `itemsSignal` once the local database write
   * completes (typically within a few ms).
   */
  public addItem = (title: string): string => {
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

    this.collection
      ?.insert(row)
      .then((doc) => {
        // Cache the freshly-inserted doc immediately, before the reactive
        // query even re-emits, so an updateItem() call fired right after
        // addItem() (e.g. typing into a just-created item) doesn't fall
        // through to the findOne() fallback below.
        this.docs.set(id, doc);
      })
      .catch((insertError: Error) => this.errorSignal.next(insertError.message));

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
    const cachedDoc = this.docs.get(id);
    if (cachedDoc) {
      this.docs.delete(id);
      cachedDoc.remove().catch((removeError: Error) => this.errorSignal.next(removeError.message));
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
