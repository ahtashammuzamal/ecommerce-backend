import { describe, it, expect } from "vitest";
import { toPublicUser } from "../../../utils/toPublic.js";

describe("toPublicUser()", () => {
  const rawUser = {
    id: "user-abc-123",
    name: "John Doe",
    email: "john@example.com",
    password: "hashedpassword",
    tokens: ["jwt-token-xyz"],
    role: "CUSTOMER",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  it("should include safe public fields", () => {
    const publicUser = toPublicUser(rawUser);

    expect(publicUser.id).toBe("user-abc-123");
    expect(publicUser.name).toBe("John Doe");
    expect(publicUser.email).toBe("john@example.com");
    expect(publicUser.role).toBe("CUSTOMER");
  });

  it("should remove the password field", () => {
    const publicUser = toPublicUser(rawUser);
    expect(publicUser.password).toBeUndefined();
  });

  it("should remove the tokens field", () => {
    const publicUser = toPublicUser(rawUser);
    expect(publicUser.tokens).toBeUndefined();
  });

  it("should include timestamps", () => {
    const publicUser = toPublicUser(rawUser);
    expect(publicUser.createdAt).toBeDefined();
    expect(publicUser.updatedAt).toBeDefined();
  });
});
