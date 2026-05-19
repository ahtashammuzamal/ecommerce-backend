import { describe, it, expect } from "vitest";
import { hashPassword, compareHash } from "../../../utils/hashPassword.js";

describe("hashPassword()", () => {
  it("should return a hashed string different from the original", async () => {
    const hashed = await hashPassword("mypassword123");

    expect(hashed).toBeDefined();
    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe("mypassword123");
  });

  it("should produce a different hash each time", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");

    expect(hash1).not.toBe(hash2);
  });
});

describe("compareHash()", () => {
  it("should return true when password matches the hash", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await compareHash("correctpassword", hash);

    expect(result).toBe(true);
  });

  it("should return false when password does not match", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await compareHash("wrongpassword", hash);

    expect(result).toBe(false);
  });
});
