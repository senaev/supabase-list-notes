import "./MainPageHeader.css";

import {
  ArrowLeftOnRectangleIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { APP_BASE_URL } from "../../const/APP_BASE_URL";
import { NBSP } from "../../const/NBSP";
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from "../../const/SUPABASE_CREDENTIALS_QUERY_PARAMS";
import { useSupabaseClientContext } from "../../contexts/SupabaseClientContext";
import { useToastsContext } from "../../contexts/ToastsContext";
import { ActiveEditorEmojisByItemId } from "../../presence/ActiveItemsPresenceStore";
import { Item } from "../../sync/types";
import { ContextMenu, ContextMenuItem } from "../ContextMenu/ContextMenu";
import { ItemTypesNav } from "../ItemTypesNav/ItemTypesNav";
import { PageHeader } from "../PageHeader/PageHeader";
import appLogoUrl from "/logo.svg";

// Both props are optional because the header is also rendered on its own
// while the Supabase client is still initializing (see App), when there are
// neither items nor a presence channel yet.
export function MainPageHeader({
  items = [],
  activeEditorEmojisByItemId = {},
}: {
  items?: Item[];
  activeEditorEmojisByItemId?: ActiveEditorEmojisByItemId;
}) {
  const { showError, showInfoMessage } = useToastsContext();
  const statusObject = useSupabaseClientContext();

  const menu: ContextMenuItem[] =
    statusObject.status === "ready"
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
                },
              );

              navigator.clipboard
                .writeText(shareUrl.toString())
                .then(() => {
                  showInfoMessage(
                    "Share link copied to clipboard. ⚠️ Anyone with this link can view and edit your notes.",
                  );
                })
                .catch((error) => {
                  showError(
                    `Failed to copy credentials to clipboard. Error: ${error.message}`,
                  );
                });
            },
          },
          {
            label: "Logout",
            Icon: ArrowLeftOnRectangleIcon,
            onSelect: () => {
              statusObject.logout();
            },
          },
        ]
      : [];

  return (
    <PageHeader
      homeButtonIcon={
        <img className="MainPageHeader__logo" src={appLogoUrl} alt="Home" />
      }
    >
      <ItemTypesNav
        activeEditorEmojisByItemId={activeEditorEmojisByItemId}
        items={items}
      />
      <ContextMenu items={menu} />
    </PageHeader>
  );
}
