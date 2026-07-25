import { describe, expect, it } from "vitest";
import { noop } from "./noop";

describe("noop", () => {
  it("returns undefined", () => {
    expect(noop()).toBeUndefined();
  });

  it("accepts and ignores any arguments without throwing", () => {
    expect(() => noop(1, "two", { three: 3 })).not.toThrow();
    expect(noop(1, "two", { three: 3 })).toBeUndefined();
  });
});
