import "./NoteItemElement.css";

import classNames from "classnames";
import { KeyboardEvent, PointerEvent, SyntheticEvent } from "react";
import { DEBUG_ENABLED } from "../../const/DEBUG_ENABLED";
import { NoteItem } from "../../types/NoteItem";

type DragState = "overlay" | "source" | "source-collapsed" | "placeholder";

const DRAG_STATE_CLASSES: Record<DragState, string[]> = {
  overlay: ["NoteItemElement_dragOverlay"],
  source: ["NoteItemElement_dragSource"],
  "source-collapsed": [
    "NoteItemElement_dragSource",
    "NoteItemElement_dragCollapsed",
  ],
  placeholder: ["NoteItemElement_dragSource"],
};

export type DragStartCallback = (event: PointerEvent<HTMLDivElement>) => void;

export function NoteItemElement({
  item,
  toggleChecked,
  onChange,
  onKeyDown,
  onRemove,
  dragState,
  onDragStart,
  resizeTextarea,
  inputRefs,
  onTextSelectionChange,
  readonlyText,
}: {
  item: NoteItem;
  toggleChecked: (checked: boolean) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemove: VoidFunction;
  dragState: DragState | undefined;
  onDragStart: DragStartCallback | undefined;
  resizeTextarea: (input: HTMLTextAreaElement) => void;
  inputRefs: React.RefObject<Map<string, HTMLTextAreaElement>>;
  readonlyText: boolean;
  onTextSelectionChange: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div
      className={classNames(
        "NoteItemElement",
        DRAG_STATE_CLASSES[dragState as DragState],
        {
          NoteItemElement_child: item.is_child,
          NoteItemElement_isChecked: Boolean(item.completed_at),
        },
      )}
    >
      <div
        className={classNames("NoteItemElement__dragHandle", {
          NoteItemElement__dragHandle_disabled: !onDragStart,
        })}
        role={onDragStart ? "button" : undefined}
        tabIndex={onDragStart ? 0 : undefined}
        onPointerDown={onDragStart}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <span className="NoteItemElement__dragHandle__visual" />
      </div>
      <label className="NoteItemElement__checkboxLabel">
        <input
          aria-label={`Mark ${item.title || "item"} as checked`}
          checked={Boolean(item.completed_at)}
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
              color: "#FFCA98",
            }}
          >
            pos=[{item.position}]
          </span>
          <span
            style={{
              color: "#98FFAE",
            }}
          >
            id=[{item.id}]
          </span>
          <span
            style={{
              color: "#C1FF98",
            }}
          >
            updated=[{new Date(item.updated_at).getTime()}]
          </span>
          <span>{item.persisted ? "✅" : "⏳"}</span>
        </span>
      )}
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
