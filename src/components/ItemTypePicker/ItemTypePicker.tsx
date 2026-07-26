import "./ItemTypePicker.css";

import classNames from "classnames";
import { useState } from "react";
import { useToastsContext } from "../../contexts/ToastsContext";
import { getItemTypeColor } from "../../utils/getItemTypeColor";
import { validateItemType } from "../../utils/validateItemType";

/**
 * Small popup, anchored under the type tag, listing every distinct type
 * currently in use (plus the item's own current type) so the user can pick
 * one, or create a brand new one via a prompt.
 *
 * Follows the same focus/blur-driven open-close convention as ContextMenu
 * (see src/components/ContextMenu/ContextMenu.tsx) rather than introducing
 * a click-outside listener or portal, since that's the only floating-panel
 * precedent in this codebase.
 */
export function ItemTypePicker({
  currentType,
  existingTypes,
  onSelect,
}: {
  currentType: string;
  existingTypes: string[];
  onSelect: (type: string) => void;
}) {
  const { showError } = useToastsContext();
  const [isOpen, setIsOpen] = useState(false);

  // De-duped, alphabetical, and guaranteed to include the item's own
  // current type even if it's otherwise unused by any other item.
  const allTypes = Array.from(new Set([currentType, ...existingTypes])).sort(
    (a, b) => a.localeCompare(b),
  );

  function selectType(type: string) {
    onSelect(type);
    setIsOpen(false);
  }

  function createNewType() {
    // Hide the popup first, then prompt for the new type name.
    setIsOpen(false);

    const rawInput = window.prompt("New type name:");
    if (rawInput === null) {
      // User cancelled the prompt.
      return;
    }

    const validationError = validateItemType(rawInput);
    if (validationError) {
      showError(validationError);
      return;
    }

    onSelect(rawInput.trim());
  }

  return (
    <div
      className="ItemTypePicker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
      onFocus={() => {
        setIsOpen(true);
      }}
    >
      <button
        aria-label={`Change type, currently ${currentType}`}
        className="ItemTypePicker__trigger"
        style={{ backgroundColor: getItemTypeColor(currentType) }}
        type="button"
      >
        {currentType}
      </button>
      {isOpen && (
        <div className="ItemTypePicker__menu" role="menu">
          {allTypes.map((type) => (
            <button
              key={type}
              className={classNames("ItemTypePicker__item", {
                ItemTypePicker__item_isSelected: type === currentType,
              })}
              onClick={() => {
                selectType(type);
              }}
              role="menuitem"
              type="button"
            >
              <span
                className="ItemTypePicker__itemSwatch"
                style={{ backgroundColor: getItemTypeColor(type) }}
              />
              {type}
            </button>
          ))}
          <button
            className="ItemTypePicker__item ItemTypePicker__createItem"
            onClick={createNewType}
            role="menuitem"
            type="button"
          >
            + Create new
          </button>
        </div>
      )}
    </div>
  );
}
