# E-Commerce Backend API

Backend API for a portfolio e-commerce project built with Node.js, Express, Prisma, and PostgreSQL. This repository is responsible for authentication, product management, cart operations, order processing, category data, and image uploads.

The application is configured to run against a deployed Supabase Postgres database while keeping the frontend in a separate repository.

Companion frontend repository: [ecommerce-frontend](https://github.com/ahtashammuzamal/ecommerce-frontend)

## Portfolio Context

This project was built to demonstrate backend engineering skills that are common in production web applications. It highlights the ability to:

- Design and manage a relational data model
- Build REST endpoints for a multi-step commerce workflow
- Implement authentication and role-based authorization
- Handle file uploads for product images
- Use transactions for order creation and cart cleanup
- Keep the API isolated from the frontend in a separate repository

## Core Capabilities

- User registration, login, logout, profile retrieval, and password change
- JWT-based protected routes
- Admin-only product creation, update, and deletion
- Product listing with search, category filtering, price filtering, sorting, and pagination-ready query params
- Persistent cart creation and cart item management
- Order creation from cart contents
- Pending-order cancellation for customers
- Admin order review with status updates
- Category retrieval for frontend product filters and forms
- Product image uploads through Multer and Cloudinary
- Category image seeding through Cloudinary secure URLs for frontend-safe rendering
- Supabase Postgres integration for hosted database deployments

## Tech Stack

- Node.js
- Express 5
- PostgreSQL
- Supabase Postgres
- Prisma ORM
- Prisma Postgres adapter
- JWT
- bcryptjs
- Multer
- Cloudinary
- dotenv

## Repository Relationship

This project is intentionally separated into two repositories to reflect a real-world client/server architecture.

- Backend repository: [ecommerce_backend](https://github.com/ahtashammuzamal/ecommerce_backend)
- Frontend repository: [ecommerce-frontend](https://github.com/ahtashammuzamal/ecommerce-frontend)
- Default local server URL: `http://localhost:5000`
- Frontend origin currently allowed by CORS: `http://localhost:5173`

## Data Model Overview

The API is backed by PostgreSQL and Prisma models for:

- `User`
- `Product`
- `Category`
- `Cart`
- `CartItem`
- `Order`
- `OrderItem`

It also uses role and order-status enums to support authorization and order workflow management.

## Deployment Database Setup

This project uses Supabase as the hosted PostgreSQL provider.

- `DATABASE_URL` is used by the running API.
- `DIRECT_URL` is reserved for Prisma migrations and schema operations.
- The runtime Prisma client uses `@prisma/adapter-pg` with a `pg` pool so the app can connect cleanly to Supabase in deployed environments.
- The runtime connection strips `sslmode=require` from the pool connection string and enables SSL through the `pg` client configuration.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ahtashammuzamal/ecommerce_backend.git
cd ecommerce_backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Required environment variables:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/ecommerce_db?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/ecommerce_db?schema=public"
JSON_SECRET_KEY="replace-with-a-long-random-secret"
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

For Supabase, use two database URLs:

- `DATABASE_URL` for your app runtime. Prefer the Supabase pooler connection string if your environment does not support IPv6.
- `DIRECT_URL` for Prisma migrations. Use the direct connection string from Supabase when your environment supports IPv6, otherwise use the session pooler string provided by Supabase.

If you are using Supabase connection strings, append `?sslmode=require` unless the copied URL already includes it.

Example Supabase setup:

```env
DATABASE_URL="postgresql://postgres.<project-ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require"
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Seed starter categories

```bash
npm run seed
```

The category seeder uploads local files from `public/categories` to Cloudinary and stores the returned `secure_url` values in the database. This makes the images usable from the separate frontend without relying on backend-local static file paths.

### 6. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

## Available Scripts

- `npm run dev` starts the API with Nodemon
- `npm run seed` uploads category images to Cloudinary and seeds starter categories

## API Overview

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a user |
| `POST` | `/api/auth/login` | Log in and receive a token |
| `GET` | `/api/auth/my-profile` | Fetch the authenticated user |
| `POST` | `/api/auth/logout` | Log out the current session |
| `POST` | `/api/auth/change-password` | Change the current user's password |

### Products

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/products` | List products with filters |
| `GET` | `/api/products/:id` | Fetch a single product |
| `POST` | `/api/products/create` | Create a product (admin) |
| `PATCH` | `/api/products/:id` | Update a product (admin) |
| `DELETE` | `/api/products/:id` | Delete a product (admin) |

### Cart

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/cart` | Fetch the current user's cart |
| `POST` | `/api/cart/add` | Add an item to the cart |
| `PATCH` | `/api/cart/update` | Increment or decrement cart quantity |
| `DELETE` | `/api/cart/:id` | Remove a cart item |
| `POST` | `/api/cart/clear` | Clear the cart |

### Orders

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/orders` | Fetch the current user's orders |
| `POST` | `/api/orders/create` | Create an order from the cart |
| `PATCH` | `/api/orders/:orderId/cancel` | Cancel a pending order |
| `GET` | `/api/orders/all` | Fetch all orders (admin) |
| `PATCH` | `/api/orders/:orderId/status` | Update order status (admin) |

### Categories

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/categories` | Fetch all categories |

## What This Repository Demonstrates

- Secure route protection with token-based authentication
- Role-based access control for admin operations
- Relational modeling for products, carts, and orders
- Query-driven product listing for frontend filtering and sorting
- Transactional order creation with cart cleanup
- Media upload handling for product management
- Hosted Postgres integration using Supabase
- Frontend-safe category image delivery via Cloudinary secure URLs

## Next Improvements

- Add automated API and integration tests
- Add request validation middleware for stricter input handling
- Add deployment, logging, and CI/CD automation documentation

## Notes

- This repository contains the backend API only.
- The client application lives in a separate repository linked above.
- To test the full project locally, run this API together with the frontend repository.
