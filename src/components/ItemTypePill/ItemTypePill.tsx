import "./ItemTypePill.css";

import classNames from "classnames";
import { getItemTypeColor } from "../../utils/getItemTypeColor";

// Types this short (or shorter) are always shown in full - they're already
// compact enough that shortening them isn't worth the lost readability.
const TRUNCATE_MIN_LENGTH = 6;

// When a longer type is truncated, show at most this many characters before
// the ellipsis (e.g. "groceries" -> "gro…").
const TRUNCATED_TYPE_LENGTH = 3;

/**
 * The colored, fixed-height "type" chip shared by every place a type is
 * shown as a standalone tag: the per-item trigger in ItemTypePicker and
 * the filter chips in ItemTypesNav. Pulled out into its own component (as
 * opposed to each place styling its own button) so its size/shape/color
 * logic has exactly one definition and can't drift between the two.
 */
export function ItemTypePill({
  type,
  onClick,
  isActive,
  truncate,
  ariaLabel,
  className,
  emojis,
}: {
  type: string;
  onClick?: VoidFunction;
  isActive?: boolean;
  // Show only the first few characters + "…". The full type stays in the
  // title/aria-label so it's still discoverable. Used for the per-item
  // pills while a type filter is active, where the type is redundant with
  // the active filter and just eats horizontal space.
  truncate?: boolean;
  ariaLabel?: string;
  className?: string;
  // Animal avatars of anyone currently editing an item of this type (see
  // ActiveItemsPresenceStore), shown inside the pill. Only the nav's filter
  // chips use this - the per-item pill's neighbours already show them (see
  // NoteItemElement), so repeating them there would be noise.
  emojis?: string[];
}) {
  const label =
    truncate && type.length > TRUNCATE_MIN_LENGTH
      ? `${type.slice(0, TRUNCATED_TYPE_LENGTH)}…`
      : type;

  return (
    <button
      aria-current={isActive}
      aria-label={ariaLabel}
      className={classNames(
        "ItemTypePill",
        { ItemTypePill_isActive: isActive },
        className,
      )}
      onClick={onClick}
      style={
        {
          backgroundColor: getItemTypeColor(type),
          // Exposed as a CSS var so the active-state highlight ring can be
          // drawn in the pill's own type color (see ItemTypePill.css).
          "--pill-color": getItemTypeColor(type),
        } as React.CSSProperties
      }
      title={type}
      type="button"
    >
      {label}
      {emojis && emojis.length > 0 && (
        // Decorative here on purpose: it would otherwise pollute the
        // button's accessible name ("groceries bear face"). The
        // authoritative, properly-labelled indicator is the per-item one in
        // NoteItemElement, one tap away.
        <span aria-hidden="true" className="ItemTypePill__emojis">
          {emojis.join("")}
        </span>
      )}
    </button>
  );
}
