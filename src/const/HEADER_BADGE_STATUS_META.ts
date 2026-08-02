import { NetworkSyncStatus } from '../sync/types';

/**
 * The states that get a badge on MainPageHeader's logo.
 *
 * "synced" is deliberately absent - it shows no badge at all, so an
 * unbadged, full-color logo is what "everything is fine" looks like.
 * "unauthenticated" isn't a sync state at all (there's no sync engine
 * running before login - see App); it comes from SupabaseController's
 * status and takes precedence over everything else, since being logged
 * out is the thing the user has to act on first.
 */
export type HeaderBadgeStatus = Exclude<NetworkSyncStatus, 'synced'> | 'unauthenticated';

export const HEADER_BADGE_STATUS_META: Record<HeaderBadgeStatus, { emoji: string; label: string }> =
    {
        unauthenticated: {
            emoji: '🔑',
            label: 'Not logged in',
        },
        offline: {
            emoji: '🤷',
            label: 'No connection',
        },
        syncing: {
            emoji: '🔄',
            label: 'Syncing…',
        },
    };
