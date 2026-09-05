import './MainPageHeader.css';

import { ArrowLeftOnRectangleIcon, ShareIcon } from '@heroicons/react/24/outline';

import { APP_BASE_URL } from '../../const/APP_BASE_URL';
import { NBSP } from '../../const/NBSP';
import { HEADER_BADGE_STATUS_META, HeaderBadgeStatus } from '../../const/HEADER_BADGE_STATUS_META';
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from '../../const/SUPABASE_CREDENTIALS_QUERY_PARAMS';
import { useToastsContext } from '../../contexts/ToastsContext';
import { ActiveEditorEmojisByItemId } from '../../presence/ActiveItemsPresenceStore';
import { Item, NetworkSyncStatus } from '../../sync/types';
import { ContextMenu, ContextMenuItem } from '../ContextMenu/ContextMenu';
import { ItemTypesNav } from '../ItemTypesNav/ItemTypesNav';
import { PageHeader } from '../PageHeader/PageHeader';
import appLogoUrl from '/logo.svg';
import { useSupabaseControllerStatus } from '../../contexts/SupabaseControllerStatusContext';
import { useLocalDb } from '../../contexts/LocalDbContext';

// All three are optional because the header is also rendered on its own
// while the Supabase client is still initializing (see App), when there are
// neither items, a presence channel, nor a sync engine yet.
export function MainPageHeader({
    items = [],
    typesByPopularity = [],
    activeEditorEmojisByItemId = {},
    networkSyncStatus,
}: {
    items?: Item[];
    typesByPopularity?: string[];
    activeEditorEmojisByItemId?: ActiveEditorEmojisByItemId;
    networkSyncStatus?: NetworkSyncStatus;
}) {
    const { showError, showInfoMessage } = useToastsContext();
    const statusObject = useSupabaseControllerStatus();
    const localDbResult = useLocalDb();
    const localDb =
        localDbResult && 'data' in localDbResult ? localDbResult.data.localDb : undefined;

    const menu: ContextMenuItem[] =
        statusObject.status === 'ready'
            ? [
                  {
                      label: `Share${NBSP}access`,
                      Icon: ShareIcon,
                      onSelect: () => {
                          const shareUrl = new URL(APP_BASE_URL, window.location.origin);

                          Object.entries(SUPABASE_CREDENTIALS_QUERY_PARAMS).forEach(
                              ([credentialKey, queryParam]) => {
                                  const credentialValue =
                                      statusObject.credentials[
                                          credentialKey as keyof typeof statusObject.credentials
                                      ];

                                  shareUrl.searchParams.set(queryParam, credentialValue);
                              }
                          );

                          navigator.clipboard
                              .writeText(shareUrl.toString())
                              .then(() => {
                                  showInfoMessage(
                                      'Share link copied to clipboard. ⚠️ Anyone with this link can view and edit your notes.'
                                  );
                              })
                              .catch((error) => {
                                  showError(
                                      `Failed to copy credentials to clipboard. Error: ${error.message}`
                                  );
                              });
                      },
                  },
                  {
                      label: 'Logout',
                      Icon: ArrowLeftOnRectangleIcon,
                      onSelect: () => {
                          statusObject.logout();
                          localDb?.remove().catch((error: Error) => {
                              showError(`Failed to clear local database: ${error.message}`);
                          });
                      },
                  },
              ]
            : [];

    // Being logged out wins over any sync state: there's no sync engine
    // running at all before login (see App), and it's the thing the user has
    // to act on first anyway. "initialization" deliberately gets no badge -
    // it's a brief transient state, and flashing a "not logged in" key at
    // someone who *is* logged in would be worse than showing nothing.
    let badgeStatus: HeaderBadgeStatus | undefined;

    if (
        statusObject.status === 'require-credentials' ||
        statusObject.status === 'wrong-credentials'
    ) {
        badgeStatus = 'unauthenticated';
    } else if (networkSyncStatus && networkSyncStatus !== 'synced') {
        badgeStatus = networkSyncStatus;
    }

    const statusMeta = badgeStatus ? HEADER_BADGE_STATUS_META[badgeStatus] : undefined;

    return (
        <PageHeader
            homeButtonIcon={
                <span className={'MainPageHeader__logoWrapper'}>
                    <img
                        className={
                            statusMeta
                                ? 'MainPageHeader__logo MainPageHeader__logo--muted'
                                : 'MainPageHeader__logo'
                        }
                        src={appLogoUrl}
                        alt={'Home'}
                    />
                    {statusMeta && (
                        <span
                            aria-label={statusMeta.label}
                            className={'MainPageHeader__syncBadge'}
                            title={statusMeta.label}
                        >
                            {statusMeta.emoji}
                        </span>
                    )}
                </span>
            }
        >
            <ItemTypesNav
                activeEditorEmojisByItemId={activeEditorEmojisByItemId}
                items={items}
                typesByPopularity={typesByPopularity}
            />
            <ContextMenu items={menu} />
        </PageHeader>
    );
}
