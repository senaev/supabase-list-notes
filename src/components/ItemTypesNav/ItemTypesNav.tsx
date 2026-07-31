import "./ItemTypesNav.css";

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ActiveEditorEmojisByItemId } from "../../presence/ActiveItemsPresenceStore";
import { Item } from "../../sync/types";
import { ItemTypePill } from "../ItemTypePill/ItemTypePill";

/**
 * Horizontally-scrollable row of colored type chips, replacing the static
 * app title in MainPageHeader. Clicking a chip filters NotePage down to
 * that type via the `type` search param (read there with useSearchParams);
 * clicking the home button (see PageHeader) navigates back to `ROUTES.home`
 * with no search params, resetting the filter.
 */
export function ItemTypesNav({
  items,
  activeEditorEmojisByItemId,
}: {
  items: Item[];
  activeEditorEmojisByItemId: ActiveEditorEmojisByItemId;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentType = searchParams.get("type");

  // Sorted by popularity - how many items (checked or unchecked) currently
  // have each type - most popular first.
  const typesByPopularity = useMemo(() => {
    const countByType = new Map<string, number>();
    for (const item of items) {
      countByType.set(item.type, (countByType.get(item.type) ?? 0) + 1);
    }

    return Array.from(countByType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
  }, [items]);

  // Rolls the per-item avatars up to the type level, so a chip shows who is
  // editing something inside it even while that item is scrolled out of
  // view (or filtered out entirely). Kept separate from the popularity memo
  // above so a presence change doesn't recount every type.
  const emojisByType = useMemo(() => {
    const result = new Map<string, string[]>();

    for (const item of items) {
      const itemEmojis = activeEditorEmojisByItemId[item.id];
      if (!itemEmojis) {
        continue;
      }

      const typeEmojis = result.get(item.type) ?? [];
      for (const emoji of itemEmojis) {
        // One person editing two items of the same type is still one avatar.
        if (!typeEmojis.includes(emoji)) {
          typeEmojis.push(emoji);
        }
      }
      result.set(item.type, typeEmojis);
    }

    return result;
  }, [items, activeEditorEmojisByItemId]);

  if (typesByPopularity.length === 0) {
    return <div className="ItemTypesNav" />;
  }

  return (
    <nav aria-label="Filter items by type" className="ItemTypesNav">
      {typesByPopularity.map((type) => (
        <ItemTypePill
          key={type}
          className="ItemTypesNav__pill"
          emojis={emojisByType.get(type)}
          isActive={type === currentType}
          onClick={() => {
            setSearchParams({ type });
          }}
          type={type}
        />
      ))}
    </nav>
  );
}
