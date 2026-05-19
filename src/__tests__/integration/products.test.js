import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

vi.mock("../../config/prisma.js", () => ({
  default: {
    user: { findUnique: vi.fn() },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

vi.mock("../../lib/redis.js", () => ({
  clearProductCache: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "../../config/prisma.js";
import redisClient from "../../config/redis.js";
import { fakeAdmin, fakeUser, generateToken } from "../helpers/auth.helper.js";

beforeEach(() => {
  vi.clearAllMocks();
  redisClient.get.mockResolvedValue(null);
  redisClient.set.mockResolvedValue("OK");
});

const fakeProduct = {
  id: 1,
  title: "Test Sneakers",
  description: "Very nice shoes",
  price: 99.99,
  images: ["https://example.com/image1.jpg"],
  stock: 50,
  categoryId: 1,
  isFeatured: false,
  category: { id: 1, name: "Shoes", slug: "shoes" },
};


describe("GET /api/products", () => {
  it("should return a list of products with pagination meta", async () => {
    prisma.product.count.mockResolvedValue(1);
    prisma.product.findMany.mockResolvedValue([fakeProduct]);

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].title).toBe("Test Sneakers");
    expect(response.body.meta.total).toBe(1);
    expect(response.body.meta.totalPages).toBe(1);
  });

  it("should serve from cache without hitting the database", async () => {
    const cachedData = { products: [fakeProduct], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
    redisClient.get.mockResolvedValue(JSON.stringify(cachedData));

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("should return an empty products array when none exist", async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.product.findMany.mockResolvedValue([]);

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(0);
    expect(response.body.meta.total).toBe(0);
  });
});


describe("GET /api/products/:id", () => {
  it("should return a single product when found", async () => {
    prisma.product.findUnique.mockResolvedValue(fakeProduct);

    const response = await request(app).get("/api/products/1");

    expect(response.status).toBe(200);
    expect(response.body.product.title).toBe("Test Sneakers");
    expect(response.body.product.price).toBe(99.99);
  });

  it("should return 404 when product does not exist", async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const response = await request(app).get("/api/products/999");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Product does not exists.");
  });

  it("should serve a single product from cache without hitting the database", async () => {
    redisClient.get.mockResolvedValue(JSON.stringify({ product: fakeProduct }));

    const response = await request(app).get("/api/products/1");

    expect(response.status).toBe(200);
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });
});


describe("POST /api/products/create", () => {
  it("should return 401 if no token is provided", async () => {
    const response = await request(app).post("/api/products/create").field("title", "New Product");
    expect(response.status).toBe(401);
  });

  it("should return 400 if a customer tries to create a product", async () => {
    const token = generateToken(fakeUser);

    prisma.user.findUnique.mockResolvedValue({ id: fakeUser.id, email: fakeUser.email, role: "CUSTOMER" });

    const response = await request(app)
      .post("/api/products/create")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "New Product")
      .field("price", "49.99");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("should create a product when an admin sends a valid request", async () => {
    const token = generateToken(fakeAdmin);

    prisma.user.findUnique.mockResolvedValue({ id: fakeAdmin.id, email: fakeAdmin.email, role: "ADMIN" });
    prisma.product.create.mockResolvedValue(fakeProduct);

    const response = await request(app)
      .post("/api/products/create")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Test Sneakers")
      .field("description", "Very nice shoes")
      .field("price", "99.99")
      .field("categoryId", "1")
      .field("stock", "50");

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Product created successfully");
    expect(response.body.product.title).toBe("Test Sneakers");
  });
});


describe("DELETE /api/products/:id", () => {
  it("should return 401 if no token is provided", async () => {
    const response = await request(app).delete("/api/products/1");
    expect(response.status).toBe(401);
  });

  it("should return 404 if the product does not exist", async () => {
    const token = generateToken(fakeAdmin);

    prisma.user.findUnique.mockResolvedValue({ id: fakeAdmin.id, email: fakeAdmin.email, role: "ADMIN" });
    prisma.product.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .delete("/api/products/999")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("should delete a product successfully", async () => {
    const token = generateToken(fakeAdmin);

    prisma.user.findUnique.mockResolvedValue({ id: fakeAdmin.id, email: fakeAdmin.email, role: "ADMIN" });
    prisma.product.findUnique.mockResolvedValue(fakeProduct);
    prisma.product.delete.mockResolvedValue(fakeProduct);

    const response = await request(app)
      .delete("/api/products/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Product deleted successfull");
  });
});
