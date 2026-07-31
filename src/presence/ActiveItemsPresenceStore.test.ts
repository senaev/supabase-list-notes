import { describe, expect, it } from "vitest";
import { collectActiveEditorEmojis } from "./ActiveItemsPresenceStore";

const OWN_KEY = "own-tab";

/** Shapes one meta the way realtime-js hands it to us after transformState. */
function meta(emoji: string, itemId: string | null, presenceRef: string) {
  return { emoji, itemId, presence_ref: presenceRef };
}

describe("collectActiveEditorEmojis", () => {
  it("maps each other tab's active item to its avatar", () => {
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [meta("🐻", "item-1", "1")],
          "tab-b": [meta("🦊", "item-2", "2")],
        },
        OWN_KEY,
      ),
    ).toEqual({ "item-1": ["🐻"], "item-2": ["🦊"] });
  });

  it("ignores this tab's own presence", () => {
    expect(
      collectActiveEditorEmojis(
        { [OWN_KEY]: [meta("🐻", "item-1", "1")] },
        OWN_KEY,
      ),
    ).toEqual({});
  });

  it("credits only the newest item when a tab moves between items", () => {
    // Phoenix's syncDiff accumulates metas per key (oldest first) when a
    // client re-tracks, so the payload for the item the user moved away
    // from is still present here and must not be rendered.
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [meta("🐻", "item-1", "1"), meta("🐻", "item-2", "2")],
        },
        OWN_KEY,
      ),
    ).toEqual({ "item-2": ["🐻"] });
  });

  it("drops a tab that went idle, even with earlier items in its history", () => {
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [meta("🐻", "item-1", "1"), meta("🐻", null, "2")],
        },
        OWN_KEY,
      ),
    ).toEqual({});
  });

  it("shows a shared avatar once when two tabs sit on the same item", () => {
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [meta("🐻", "item-1", "1")],
          "tab-b": [meta("🐻", "item-1", "2")],
        },
        OWN_KEY,
      ),
    ).toEqual({ "item-1": ["🐻"] });
  });

  it("lists every distinct avatar on the same item", () => {
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [meta("🐻", "item-1", "1")],
          "tab-b": [meta("🦊", "item-1", "2")],
        },
        OWN_KEY,
      ),
    ).toEqual({ "item-1": ["🐻", "🦊"] });
  });

  it("skips malformed payloads from other app versions", () => {
    expect(
      collectActiveEditorEmojis(
        {
          "tab-a": [{ presence_ref: "1" }],
          "tab-b": [meta("", "item-1", "2")],
          "tab-c": [meta("🦉", "item-2", "3")],
        },
        OWN_KEY,
      ),
    ).toEqual({ "item-2": ["🦉"] });
  });
});
