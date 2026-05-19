import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

vi.mock("../../config/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../config/redis.js", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

import prisma from "../../config/prisma.js";
import { fakeUser, generateToken } from "../helpers/auth.helper.js";

beforeEach(() => {
  vi.clearAllMocks();
});


describe("POST /api/auth/register", () => {
  it("should register a new user and return 201 with a token", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(fakeUser);
    prisma.user.update.mockResolvedValue({});

    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Customer", email: "customer@test.com", password: "password123" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("User created successfully.");
    expect(response.body.token).toBeDefined();
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.email).toBe("customer@test.com");
  });

  it("should return 400 if user already exists", async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser);

    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Customer", email: "customer@test.com", password: "password123" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("User already exists");
  });

  it("should return 400 if password is shorter than 8 characters", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Customer", email: "customer@test.com", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Password must be at least 8 characters.");
  });
});


describe("POST /api/auth/login", () => {
  it("should login successfully and return 200 with a token", async () => {
    const { hashPassword } = await import("../../utils/hashPassword.js");
    const realHash = await hashPassword("password123");

    prisma.user.findUnique.mockResolvedValue({ ...fakeUser, password: realHash });
    prisma.user.update.mockResolvedValue({});

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@test.com", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User login successfully.");
    expect(response.body.token).toBeDefined();
    expect(response.body.user.password).toBeUndefined();
  });

  it("should return 400 if user is not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "password123" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("User not found.");
  });

  it("should return 400 if password is wrong", async () => {
    const { hashPassword } = await import("../../utils/hashPassword.js");
    const realHash = await hashPassword("correctpassword");

    prisma.user.findUnique.mockResolvedValue({ ...fakeUser, password: realHash });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@test.com", password: "wrongpassword" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Unauthorized.");
  });

  it("should return 400 if email or password is missing", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@test.com" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Email and password are required.");
  });
});


describe("GET /api/auth/my-profile", () => {
  it("should return the user profile when a valid token is provided", async () => {
    const token = generateToken(fakeUser);

    // verifyToken middleware calls findUnique first, then getProfile controller calls it again
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: fakeUser.id, email: fakeUser.email, role: fakeUser.role })
      .mockResolvedValueOnce(fakeUser);

    const response = await request(app)
      .get("/api/auth/my-profile")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("customer@test.com");
    expect(response.body.user.password).toBeUndefined();
  });

  it("should return 401 if no token is provided", async () => {
    const response = await request(app).get("/api/auth/my-profile");
    expect(response.status).toBe(401);
  });

  it("should return 401 if token is invalid", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/auth/my-profile")
      .set("Authorization", "Bearer this.is.a.fake.token");

    expect(response.status).toBe(401);
  });
});


describe("POST /api/auth/logout", () => {
  it("should logout successfully", async () => {
    const token = generateToken(fakeUser);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: fakeUser.id, email: fakeUser.email, role: fakeUser.role,
    });
    prisma.user.findFirst.mockResolvedValue({ ...fakeUser, tokens: [token] });
    prisma.user.update.mockResolvedValue({});

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User logout successfully.");
  });

  it("should return 401 if no token is provided", async () => {
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(401);
  });
});
