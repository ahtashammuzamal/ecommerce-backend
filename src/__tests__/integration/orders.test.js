import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

vi.mock("../../config/prisma.js", () => ({
  default: {
    user: { findUnique: vi.fn() },
    cart: { findUnique: vi.fn() },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    orderItem: { create: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
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
import { fakeUser, fakeAdmin, generateToken } from "../helpers/auth.helper.js";

const mockVerifyToken = (user = fakeUser) => {
  prisma.user.findUnique.mockResolvedValueOnce({
    id: user.id,
    email: user.email,
    role: user.role,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

const fakeProduct = { id: 5, title: "Test Sneakers", price: 99.99, stock: 10 };

const fakeCartWithItems = {
  id: 10,
  userId: fakeUser.id,
  cartItems: [{ id: 1, productId: 5, quantity: 2, product: fakeProduct }],
};

const fakeOrder = {
  id: 100,
  userId: fakeUser.id,
  total: 199.98,
  shippingAddress: "123 Test St",
  status: "PENDING",
  orderItems: [{ id: 1, orderId: 100, productId: 5, quantity: 2, subTotal: 199.98, product: fakeProduct }],
};


describe("GET /api/orders", () => {
  it("should return 401 if no token is provided", async () => {
    const response = await request(app).get("/api/orders");
    expect(response.status).toBe(401);
  });

  it("should return the user's orders", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.order.findMany.mockResolvedValue([fakeOrder]);

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.orders[0].status).toBe("PENDING");
  });

  it("should return an empty array when user has no orders", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.order.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(0);
  });
});


describe("POST /api/orders/create", () => {
  it("should return 401 if no token is provided", async () => {
    const response = await request(app).post("/api/orders/create").send({ shippingAddress: "123 Test St" });
    expect(response.status).toBe(401);
  });

  it("should return 400 if shippingAddress is missing", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();

    const response = await request(app)
      .post("/api/orders/create")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Shipping address is required for order");
  });

  it("should return 400 if the cart is empty", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue({ id: 10, userId: fakeUser.id, cartItems: [] });

    const response = await request(app)
      .post("/api/orders/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: "123 Test St" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cart is empty");
  });

  it("should return 400 if user has no cart", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/orders/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: "123 Test St" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cart is empty");
  });

  it("should create an order from cart items and return 201", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue(fakeCartWithItems);

    prisma.$transaction.mockImplementation(async (callback) => {
      const fakeTx = {
        order: { create: vi.fn().mockResolvedValue(fakeOrder) },
        orderItem: { create: vi.fn().mockResolvedValue({}) },
        cartItem: { deleteMany: vi.fn().mockResolvedValue({}) },
      };
      return callback(fakeTx);
    });

    prisma.order.findUnique.mockResolvedValue(fakeOrder);

    const response = await request(app)
      .post("/api/orders/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: "123 Test St" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Order created successfully");
    expect(response.body.order.total).toBe(199.98);
  });
});


describe("GET /api/orders/all", () => {
  it("should return 401 if no token is provided", async () => {
    const response = await request(app).get("/api/orders/all");
    expect(response.status).toBe(401);
  });

  it("should return 400 if a customer tries to access all orders", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken(fakeUser);

    const response = await request(app)
      .get("/api/orders/all")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("should return all orders for an admin", async () => {
    const token = generateToken(fakeAdmin);
    mockVerifyToken(fakeAdmin);

    prisma.$transaction.mockResolvedValue([
      [fakeOrder],
      1,
      [{ status: "PENDING", _count: { status: 1 } }],
    ]);

    const response = await request(app)
      .get("/api/orders/all")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.totalOrders).toBe(1);
    expect(response.body.PENDING).toBe(1);
  });
});
