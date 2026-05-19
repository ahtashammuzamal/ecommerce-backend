import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

vi.mock("../../config/prisma.js", () => ({
  default: {
    category: {
      findMany: vi.fn(),
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
import redisClient from "../../config/redis.js";

beforeEach(() => {
  vi.clearAllMocks();
  redisClient.get.mockResolvedValue(null);
  redisClient.set.mockResolvedValue("OK");
});

const fakeCategories = [
  { id: 1, name: "Electronics", slug: "electronics", products: [] },
  { id: 2, name: "Clothing", slug: "clothing", products: [] },
];


describe("GET /api/categories", () => {
  it("should return categories from the database when cache is empty", async () => {
    prisma.category.findMany.mockResolvedValue(fakeCategories);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.categories).toHaveLength(2);
    expect(response.body.categories[0].name).toBe("Electronics");
  });

  it("should return cached categories without hitting the database", async () => {
    redisClient.get.mockResolvedValue(JSON.stringify(fakeCategories));

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.categories).toHaveLength(2);
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it("should return an empty array when no categories exist", async () => {
    prisma.category.findMany.mockResolvedValue([]);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.categories).toHaveLength(0);
  });
});
