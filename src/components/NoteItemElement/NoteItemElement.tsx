import "./NoteItemElement.css";

import classNames from "classnames";
import { KeyboardEvent, SyntheticEvent } from "react";
import { DEBUG_ENABLED } from "../../const/DEBUG_ENABLED";
import { Item } from "../../sync/types";
import { ItemTypePicker } from "../ItemTypePicker/ItemTypePicker";

export function NoteItemElement({
  item,
  toggleChecked,
  onChange,
  onChangeType,
  onKeyDown,
  onRemove,
  resizeTextarea,
  inputRefs,
  onTextSelectionChange,
  readonlyText,
  existingTypes,
}: {
  item: Item;
  toggleChecked: (checked: boolean) => void;
  onChange: (value: string) => void;
  onChangeType: (type: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemove: VoidFunction;
  resizeTextarea: (input: HTMLTextAreaElement) => void;
  inputRefs: React.RefObject<Map<string, HTMLTextAreaElement>>;
  readonlyText: boolean;
  onTextSelectionChange: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  existingTypes: string[];
}) {
  return (
    <div
      className={classNames("NoteItemElement", {
        NoteItemElement_isChecked: Boolean(item.checked_at),
      })}
    >
      <label className="NoteItemElement__checkboxLabel">
        <input
          aria-label={`Mark ${item.title || "item"} as checked`}
          checked={Boolean(item.checked_at)}
          className="NoteItemElement__checkbox"
          onChange={(event) => {
            toggleChecked(event.target.checked);
          }}
          readOnly={readonlyText}
          type="checkbox"
        />
      </label>
      <label className="NoteItemElement__textareaLabel">
        {readonlyText ? (
          <div className={"NoteItemElement__input"}>{item.title}</div>
        ) : (
          <textarea
            id={`input-${item.id}`}
            className={"NoteItemElement__input"}
            ref={(node) => {
              if (node) {
                inputRefs.current.set(item.id, node);
                resizeTextarea(node);
              } else {
                inputRefs.current.delete(item.id);
              }
            }}
            onChange={(event) => {
              resizeTextarea(event.currentTarget);
              onChange(event.currentTarget.value);
            }}
            onSelect={onTextSelectionChange}
            onKeyDown={onKeyDown}
            rows={1}
            value={item.title}
          />
        )}
      </label>
      {DEBUG_ENABLED && (
        <span
          style={{
            fontSize: "10px",
            fontFamily: "monospace",
            gap: "2px",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              color: "#98FFAE",
            }}
          >
            id=[{item.id.slice(0, 8)}]
          </span>
          <span
            style={{
              color: "#C1FF98",
            }}
          >
            updated=[{new Date(item._modified).getTime()}]
          </span>
        </span>
      )}
      <ItemTypePicker
        currentType={item.type}
        existingTypes={existingTypes}
        onSelect={onChangeType}
      />
      <div
        aria-label={`Remove ${item.title || "item"}`}
        className="NoteItemElement__remove"
        onClick={onRemove}
        role="button"
        tabIndex={0}
      >
        <div className="NoteItemElement__remove__visual" />
      </div>
    </div>
  );
}
