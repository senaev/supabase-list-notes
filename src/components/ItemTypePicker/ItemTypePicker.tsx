import "./ItemTypePicker.css";

import classNames from "classnames";
import { useState } from "react";
import { useToastsContext } from "../../contexts/ToastsContext";
import { getItemTypeColor } from "../../utils/getItemTypeColor";
import { validateItemType } from "../../utils/validateItemType";
import { ItemTypePill } from "../ItemTypePill/ItemTypePill";
import { Modal } from "../Modal/Modal";

/**
 * Popup listing every distinct type currently in use (plus the item's own
 * current type) so the user can pick one, or create a brand new one via a
 * prompt.
 *
 * Opened by clicking the tag and rendered as a centered, backdrop-dimmed
 * Modal (see src/components/Modal/Modal.tsx) rather than a panel anchored
 * under the tag with `position: absolute` (as ContextMenu does) - an
 * anchored panel can end up clipped or off-screen when the item is near
 * the bottom of a scrollable page.
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
    <div className="ItemTypePicker">
      <ItemTypePill
        ariaLabel={`Change type, currently ${currentType}`}
        onClick={() => {
          setIsOpen(true);
        }}
        type={currentType}
      />
      {isOpen && (
        <Modal
          ariaLabel="Choose item type"
          onClose={() => {
            setIsOpen(false);
          }}
        >
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
        </Modal>
      )}
    </div>
  );
}
