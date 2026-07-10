import { describe, expect, it } from "vitest";
import { reorderItems } from "./reorderItems";

describe("reorderItems", () => {
  it("moves a dragged item to the sortable index without duplicating ids", () => {
    expect(reorderItems(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("returns the current order when the indices are unchanged or invalid", () => {
    const order = ["a", "b", "c"];

    expect(reorderItems(order, 1, 1)).toBe(order);
    expect(reorderItems(order, -1, 2)).toBe(order);
    expect(reorderItems(order, 0, 3)).toBe(order);
  });
});
