import { describe, expect, it } from "vitest";
import { cn } from "../src/shared/lib/cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("ignores falsy conditional values", () => {
    expect(cn("a", false, undefined, null, "")).toBe("a");
  });
  it("merges conflicting tailwind classes keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("supports arrays and objects", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
  it("returns an empty string for no input", () => {
    expect(cn()).toBe("");
  });
});
