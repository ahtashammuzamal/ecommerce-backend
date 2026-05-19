// ============================================================
// INTEGRATION TEST: Cart Routes
// ============================================================
// Routes tested:
//   GET    /api/cart              (auth required)
//   POST   /api/cart/add         (auth required)
//   DELETE /api/cart/:id         (auth required)
//   PATCH  /api/cart/update      (auth required)
//
// All cart routes require a token. This reinforces the pattern of:
//   1. Generate token with generateToken(fakeUser)
//   2. Mock verifyToken's DB call (prisma.user.findUnique)
//   3. Then mock the controller's own DB calls
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app.js";

// ── Mocks ─────────────────────────────────────────────────────
vi.mock("../../config/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    cart: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
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

// ── Helper: mock a successful token verification ──────────────
// We call this inside each test to set up the verifyToken middleware mock.
// verifyToken does: prisma.user.findUnique({ where: { id, tokens: { has: token } } })
const mockVerifyToken = () => {
  prisma.user.findUnique.mockResolvedValueOnce({
    id: fakeUser.id,
    email: fakeUser.email,
    role: fakeUser.role,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fake Data ─────────────────────────────────────────────────
const fakeCart = {
  id: 10,
  userId: fakeUser.id,
  cartItems: [
    {
      id: 1,
      cartId: 10,
      productId: 5,
      quantity: 2,
      product: {
        id: 5,
        title: "Test Sneakers",
        price: 99.99,
        category: { id: 1, name: "Shoes", slug: "shoes" },
      },
    },
  ],
};

const fakeCartItem = fakeCart.cartItems[0];


// ════════════════════════════════════════════════════════════
// GET /api/cart
// ════════════════════════════════════════════════════════════
describe("GET /api/cart", () => {

  it("❌ should return 401 if no token provided", async () => {
    const response = await request(app).get("/api/cart");
    expect(response.status).toBe(401);
  });

  it("✅ should return cart with items for authenticated user", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue(fakeCart);

    const response = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.cart).toBeDefined();
    // totalCartItems = sum of all item quantities = 2
    expect(response.body.totalCartItems).toBe(2);
  });

  it("✅ should return totalCartItems=0 when user has no cart yet", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue(null); // no cart exists

    const response = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.totalCartItems).toBe(0);
  });

});


// ════════════════════════════════════════════════════════════
// POST /api/cart/add
// ════════════════════════════════════════════════════════════
describe("POST /api/cart/add", () => {

  it("❌ should return 401 if no token provided", async () => {
    const response = await request(app)
      .post("/api/cart/add")
      .send({ productId: 5, quantity: 1 });
    expect(response.status).toBe(401);
  });

  it("❌ should return 400 if productId or quantity is missing", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue({ id: 10, userId: fakeUser.id }); // cart exists

    const response = await request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 1 }); // productId is missing

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("productId and valid quantity required");
  });

  it("❌ should return 400 if quantity is less than 1", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cart.findUnique.mockResolvedValue({ id: 10, userId: fakeUser.id });

    const response = await request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: 5, quantity: 0 }); // invalid quantity

    expect(response.status).toBe(400);
  });

  it("✅ should add item to cart and return 201", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();

    // Cart already exists for user
    prisma.cart.findUnique.mockResolvedValue({ id: 10, userId: fakeUser.id });
    // upsert = create or update cart item
    prisma.cartItem.upsert.mockResolvedValue(fakeCartItem);

    const response = await request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: 5, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Product added to cart");
    expect(response.body.cartItem).toBeDefined();
  });

  it("✅ should CREATE a cart first if user has no cart, then add item", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();

    // No cart exists yet
    prisma.cart.findUnique.mockResolvedValue(null);
    // Controller creates a new cart
    prisma.cart.create.mockResolvedValue({ id: 10, userId: fakeUser.id });
    prisma.cartItem.upsert.mockResolvedValue(fakeCartItem);

    const response = await request(app)
      .post("/api/cart/add")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: 5, quantity: 2 });

    expect(response.status).toBe(201);
    // Verify that cart.create was called (cart was created on the fly)
    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: { userId: fakeUser.id },
    });
  });

});


// ════════════════════════════════════════════════════════════
// DELETE /api/cart/:id
// ════════════════════════════════════════════════════════════
describe("DELETE /api/cart/:id", () => {

  it("❌ should return 401 if no token provided", async () => {
    const response = await request(app).delete("/api/cart/1");
    expect(response.status).toBe(401);
  });

  it("❌ should return 404 if cart item does not exist or doesn't belong to user", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cartItem.findFirst.mockResolvedValue(null); // item not found

    const response = await request(app)
      .delete("/api/cart/999")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Cart item does not exist.");
  });

  it("✅ should remove cart item successfully", async () => {
    const token = generateToken(fakeUser);
    mockVerifyToken();
    prisma.cartItem.findFirst.mockResolvedValue(fakeCartItem); // item exists
    prisma.cartItem.delete.mockResolvedValue(fakeCartItem);    // delete succeeds

    const response = await request(app)
      .delete("/api/cart/1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Cart item successfully removed from from cart");
  });

});
