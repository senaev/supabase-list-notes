import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { deepEqual } from 'senaev-utils/src/utils/Object/deepEqual/deepEqual';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { getUserEmoji } from './getUserEmoji';

/**
 * Realtime channel topic for presence. Deliberately *not* the RxDB
 * replication identifier ("items-supabase-replication", see
 * src/sync/replication.ts): `client.channel(topic)` returns the *existing*
 * channel for a topic instead of creating a second one, so reusing that
 * topic here would hand us the replication plugin's own channel and let the
 * two features tear each other down.
 */
const PRESENCE_CHANNEL_TOPIC = 'active-items-presence';

/**
 * How long an active item stays advertised without any activity from its
 * editor. Refreshed on every focus and every keystroke (see
 * `setActiveItem`); once it lapses the item is cleared, so a tab left open
 * on a focused item overnight doesn't keep claiming it.
 *
 * Note this is *only* about idleness. An actual disconnect (tab closed,
 * network lost) needs no timer at all: the Realtime server drops a client's
 * presence when its socket closes and pushes the resulting state to
 * everyone else.
 */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** What each tab publishes about itself. `itemId: null` means "idle". */
type ActiveItemPresencePayload = {
    emoji: string;
    itemId: string | null;
};

/** A payload that actually names an item, i.e. one worth rendering. */
type ActiveItemPresence = {
    emoji: string;
    itemId: string;
};

/** Item id -> avatars of the *other* tabs currently on that item. */
export type ActiveEditorEmojisByItemId = Record<string, string[]>;

/**
 * Narrows one entry of the merged presence state down to something
 * renderable, or null. Both rejections are expected rather than
 * exceptional: an idle tab deliberately publishes `itemId: null`, and the
 * payload itself is untyped JSON written by another client that may be
 * running an older build of the app.
 */
function parseActiveItemPresence(payload: unknown): ActiveItemPresence | null {
    if (typeof payload !== 'object' || payload === null) {
        return null;
    }

    const { emoji, itemId } = payload as Partial<ActiveItemPresencePayload>;

    if (typeof emoji !== 'string' || !emoji) {
        return null;
    }

    if (typeof itemId !== 'string' || !itemId) {
        return null;
    }

    return {
        emoji,
        itemId,
    };
}

/**
 * Folds Realtime's merged presence state down to the avatars to render per
 * item, dropping `ownPresenceKey` (this tab shouldn't watch its own caret).
 *
 * Exported for testing: the "newest meta only" rule below is subtle enough
 * to be worth pinning down directly.
 */
export function collectActiveEditorEmojis(
    presenceState: Record<string, unknown[]>,
    ownPresenceKey: string
): ActiveEditorEmojisByItemId {
    const emojisByItemId: ActiveEditorEmojisByItemId = {};

    for (const [presenceKey, presences] of Object.entries(presenceState)) {
        // This tab's own avatar would just follow its own caret around.
        if (presenceKey === ownPresenceKey) {
            continue;
        }

        // Only the *newest* payload for a key counts. A presence key is one tab
        // (see `tabId`), and a tab has exactly one active item, so the rest of
        // this array is history, not concurrent editors.
        //
        // It has to be filtered out explicitly, because Phoenix's syncDiff
        // *accumulates* metas per key: on a join it keeps every existing meta
        // whose ref isn't in the incoming join and `unshift`es them in front of
        // it. So a tab that re-tracks (i.e. moves to another item) leaves its
        // previous payload sitting in the array unless the server also sends a
        // matching leave for it - and without this, the item the user moved
        // *away* from would keep showing their avatar forever.
        //
        // That `unshift` is also what makes the newest meta the last one.
        const activeItemPresence = parseActiveItemPresence(presences.at(-1));

        if (!activeItemPresence) {
            continue;
        }

        const { emoji, itemId } = activeItemPresence;
        const emojis = emojisByItemId[itemId] ?? [];

        // Two tabs of one browser share an avatar, so the same emoji can
        // legitimately arrive twice for the same item - show it once.
        if (!emojis.includes(emoji)) {
            emojis.push(emoji);
        }

        emojisByItemId[itemId] = emojis;
    }

    return emojisByItemId;
}

/**
 * Shows which items other people (or other tabs of the same person) are
 * editing right now, using Supabase Realtime Presence.
 *
 * Presence - rather than Broadcast - is the right primitive here precisely
 * because what's shared is coarse, slow-changing state ("this tab is on
 * item X"), which is exactly the workload Presence is built for: the server
 * keeps the merged state of every connected client, replays all of it to
 * whoever joins, and evicts a client's slice automatically when it
 * disconnects. Broadcast would be fire-and-forget, so late joiners would
 * see nothing until the next event and closed tabs would leave permanent
 * ghost avatars behind.
 *
 * `track()` is called only when the active item actually *changes*, never
 * per keystroke: Presence fans every update out to all subscribers, so
 * high-frequency tracking is explicitly warned against in Supabase's docs.
 *
 * Plain, framework-agnostic class, mirroring ItemsSyncStore: React only
 * touches it through `emojisByItemIdSignal` (wired in via `useSignal` - see
 * useActiveItemsPresence) and the `setActiveItem` method.
 */
export class ActiveItemsPresenceStore {
    public readonly emojisByItemIdSignal = new Signal<ActiveEditorEmojisByItemId>({}, deepEqual);

    /**
     * Presence key for *this tab*, not this browser: several tabs of one
     * browser must each get their own slice of presence state so they can
     * report several active items at once (under a shared key they'd
     * overwrite each other). It also lets `readPresenceState` filter this tab
     * back out - you shouldn't see your own avatar on the item you're typing
     * in, but you *should* see it on the item your other tab is on.
     */
    private readonly tabId = crypto.randomUUID();
    private readonly emoji = getUserEmoji();

    private client: SupabaseClient | null = null;
    private channel: RealtimeChannel | null = null;
    private isSubscribed = false;
    private activeItemId: string | null = null;
    private idleTimeoutId: ReturnType<typeof setTimeout> | undefined;

    // Chains lifecycles (create -> remove -> create -> ...) strictly
    // sequentially, so an in-flight `removeChannel` can never overlap the
    // next `channel()` call - which matters because `channel()` hands back
    // the existing channel for a topic while it's still registered, and a
    // channel mid-unsubscribe is not something we want to subscribe to.
    private lifecycle: Promise<void> = Promise.resolve();
    // Invalidates a since-superseded setClient() call (rapid project
    // switches, or React StrictMode's mount/unmount/mount double-invoke).
    private generation = 0;

    /**
     * (Re)points presence at the given Supabase client. Safe to call
     * repeatedly: the previous channel is always fully removed first, so one
     * project's presence can't leak into another's.
     */
    public setClient(client: SupabaseClient): void {
        const generation = ++this.generation;

        this.lifecycle = this.teardown().then(() => {
            this.subscribe(client, generation);
        });
    }

    /** Final teardown - call when the owning component unmounts. */
    public dispose(): void {
        this.generation++;
        this.lifecycle = this.teardown();
    }

    /**
     * Reports the item this tab is editing or has just focused, and refreshes
     * the idle timer. Call it both on focus and on every edit: repeat calls
     * for the item that's already active only reset the timer, they don't
     * publish anything.
     *
     * Blur deliberately does *not* clear the active item - the caret is still
     * sitting in it, so it stays claimed until IDLE_TIMEOUT_MS lapses, the
     * user focuses something else, or this tab disconnects.
     */
    public setActiveItem = (itemId: string): void => {
        this.restartIdleTimer();

        if (this.activeItemId === itemId) {
            return;
        }

        this.activeItemId = itemId;
        this.publishActiveItem();
    };

    private restartIdleTimer(): void {
        clearTimeout(this.idleTimeoutId);
        this.idleTimeoutId = setTimeout(this.clearActiveItem, IDLE_TIMEOUT_MS);
    }

    private clearActiveItem = (): void => {
        if (this.activeItemId === null) {
            return;
        }

        this.activeItemId = null;
        this.publishActiveItem();
    };

    private publishActiveItem(): void {
        const { channel } = this;

        // Nothing to publish into yet - `subscribe`'s callback re-publishes
        // once the channel is joined (and again after every reconnect), so the
        // current active item is never lost, only delayed.
        if (!channel || !this.isSubscribed) {
            return;
        }

        const payload: ActiveItemPresencePayload = {
            emoji: this.emoji,
            itemId: this.activeItemId,
        };

        channel.track(payload).catch((trackError: unknown) => {
            // Presence is cosmetic: a failed update must never surface as an
            // error toast the way a failed item write does.
            // eslint-disable-next-line no-console -- surface presence failures in devtools without a UI toast
            console.error('Failed to publish presence:', trackError);
        });
    }

    private subscribe(client: SupabaseClient, generation: number): void {
        if (generation !== this.generation) {
            return;
        }

        const channel = client.channel(PRESENCE_CHANNEL_TOPIC, {
            config: { presence: { key: this.tabId } },
        });

        this.client = client;
        this.channel = channel;

        // Only "sync" is needed: it fires alongside "join"/"leave" too, and the
        // full merged state is what we re-derive from anyway. Presence
        // listeners must be registered *before* subscribe() - realtime-js
        // throws on presence callbacks added after joining, and having one
        // registered is also what enables presence on the channel.
        channel
            .on('presence', { event: 'sync' }, () => {
                if (generation === this.generation) {
                    this.readPresenceState();
                }
            })
            .subscribe((status) => {
                if (generation !== this.generation) {
                    return;
                }

                this.isSubscribed = status === 'SUBSCRIBED';

                // Runs on the initial join *and* on every automatic rejoin after a
                // dropped connection, at which point the server has forgotten this
                // tab's slice of state and it has to be published again.
                if (this.isSubscribed && this.activeItemId !== null) {
                    this.publishActiveItem();
                }
            });
    }

    private readPresenceState(): void {
        const { channel } = this;

        if (!channel) {
            return;
        }

        const emojisByItemId = collectActiveEditorEmojis(channel.presenceState(), this.tabId);

        // Signal's deepEqual comparator swallows no-op emissions, which matters
        // because Presence re-sends the whole merged state on every change -
        // including changes that don't affect any item we render.
        this.emojisByItemIdSignal.next(emojisByItemId);
    }

    private async teardown(): Promise<void> {
        await this.lifecycle.catch(() => undefined);

        clearTimeout(this.idleTimeoutId);
        this.idleTimeoutId = undefined;
        this.isSubscribed = false;

        const { channel, client } = this;

        this.channel = null;
        this.client = null;

        this.emojisByItemIdSignal.next({});

        if (channel && client) {
            // Awaited (rather than fired and forgotten) so the chained
            // subscribe() can't call channel() while this topic is still
            // registered and get the dying channel handed back to it.
            await client.removeChannel(channel).catch(() => undefined);
        }
    }
}
