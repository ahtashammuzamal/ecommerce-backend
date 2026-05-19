import jwt from "jsonwebtoken";

const TEST_SECRET = process.env.JSON_SECRET_KEY || "test-secret-key";

export const fakeUser = {
  id: "user-customer-001",
  name: "Test Customer",
  email: "customer@test.com",
  password: "hashedpassword",
  role: "CUSTOMER",
  tokens: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const fakeAdmin = {
  id: "user-admin-001",
  name: "Test Admin",
  email: "admin@test.com",
  password: "hashedpassword",
  role: "ADMIN",
  tokens: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    TEST_SECRET
  );
};
