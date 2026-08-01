import { NetworkSyncStatus } from "../sync/types";

/**
 * Display metadata for the network/sync badge on MainPageHeader's logo
 * (see ItemsSyncStore.networkSyncStatusSignal for how the status itself is
 * derived). "synced" is deliberately excluded - it shows no badge at all
 * (see MainPageHeader), so an unbadged logo is what "everything is fine"
 * looks like.
 */
export const NETWORK_SYNC_STATUS_META: Record<
  Exclude<NetworkSyncStatus, "synced">,
  { emoji: string; label: string }
> = {
  offline: { emoji: "🤷", label: "No connection" },
  syncing: { emoji: "🔄", label: "Syncing…" },
};
