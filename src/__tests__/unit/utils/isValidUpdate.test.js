import { describe, it, expect } from "vitest";
import { isValidUpdate } from "../../../utils/isValidUpdate.js";

describe("isValidUpdate()", () => {
  const allowedFields = ["title", "description", "price", "stock"];

  it("should return true when all update fields are allowed", () => {
    const result = isValidUpdate(allowedFields, { title: "New Title", price: 99.99 });
    expect(result).toBe(true);
  });

  it("should return false when update contains a forbidden field", () => {
    const result = isValidUpdate(allowedFields, { title: "New Title", id: "hack" });
    expect(result).toBe(false);
  });

  it("should return true when all allowed fields are present", () => {
    const result = isValidUpdate(allowedFields, { title: "T", description: "D", price: 10, stock: 5 });
    expect(result).toBe(true);
  });

  it("should return true for an empty update object", () => {
    const result = isValidUpdate(allowedFields, {});
    expect(result).toBe(true);
  });
});
