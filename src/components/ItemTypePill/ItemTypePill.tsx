import "./ItemTypePill.css";

import classNames from "classnames";
import { getItemTypeColor } from "../../utils/getItemTypeColor";

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
  ariaLabel,
  className,
}: {
  type: string;
  onClick?: VoidFunction;
  isActive?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
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
      style={{ backgroundColor: getItemTypeColor(type) }}
      type="button"
    >
      {type}
    </button>
  );
}
