import prisma from "../config/prisma.js";
import { isValidUpdate } from "../utils/isValidUpdate.js";
import { uploadBuffer } from "../utils/uploadToCloudinary.js";
import redisClient from "../config/redis.js";
import { CACHE_TTL } from "../constants/redis.js";
import { clearProductCache } from "../lib/redis.js";

export const createProduct = async (req, res) => {
  try {
    let imageUrls;

    const { title, description, price, categoryId, stock } = req.body;

    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map(async (file) => {
          const cloudRes = await uploadBuffer(file.buffer);
          return cloudRes.secure_url;
        }),
      );
      imageUrls = uploads;
    }

    const product = await prisma.product.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        images: imageUrls,
        categoryId: Number(categoryId),
        stock: Number(stock),
      },
    });

    await clearProductCache();

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error in creating product",
      error: error.message,
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const {
      search,
      categories,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
      isFeatured,
    } = req.query;

    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    let categoryFilter;

    if (categories) {
      const categoryArray = categories.split(",");
      categoryFilter = {
        category: {
          slug: {
            in: categoryArray,
          },
        },
      };
    }

    const priceFilter = {
      price: {
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) }),
      },
    };

    const featuredFilter = isFeatured === "true" ? { isFeatured: true } : {};

    const where = {
      ...searchFilter,
      ...categoryFilter,
      ...priceFilter,
      ...featuredFilter,
    };

    const orderBy = {
      [sortBy]: order === "desc" ? "desc" : "asc",
    };

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    const take = pageSize;
    const skip = (pageNumber - 1) * pageSize;

    const cacheKey = `products:${JSON.stringify({ where, orderBy, pageNumber, pageSize })}`;

    const cachedProducts = await redisClient.get(cacheKey);

    if (cachedProducts) {
      console.log("Serving products from Redis");

      return res.status(200).json(JSON.parse(cachedProducts));
    }

    console.log("Serving products from DB");

    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        category: true,
      },
    });

    await redisClient.set(
      cacheKey,
      JSON.stringify({
        products,
        meta: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      }),
      {
        EX: CACHE_TTL,
      },
    );

    res.status(200).json({
      products,
      meta: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product id is required",
      });
    }

    const cachedProduct = await redisClient.get(`product:${id}`);

    if (cachedProduct) {
      console.log(`Serving product - ${id} from Redis`);
      return res.status(200).json(JSON.parse(cachedProduct));
    }

    console.log(`Serving product - ${id} from DB`);

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product does not exists.",
      });
    }

    await redisClient.set(`product:${id}`, JSON.stringify({ product }), {
      EX: CACHE_TTL,
    });

    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  const allowedUpdates = [
    "title",
    "description",
    "images",
    "existingImages",
    "price",
    "categoryId",
    "stock",
    "isFeatured",
  ];

  const {
    title,
    description,
    price,
    categoryId,
    stock,
    existingImages,
    isFeatured,
  } = req.body;

  try {
    const id = parseInt(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (!isValidUpdate(allowedUpdates, req.body)) {
      return res.status(401).json({
        message: "Invalid updates.",
      });
    }

    const currentImages = JSON.parse(existingImages);

    let updatedImageUrls = [];

    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map(async (file) => {
          const cloudRes = await uploadBuffer(file.buffer);
          return cloudRes.secure_url;
        }),
      );
      updatedImageUrls = [...uploads];
    }

    updatedImageUrls = [...updatedImageUrls, ...currentImages];

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        title: title,
        description: description,
        images: updatedImageUrls,
        price: parseFloat(price),
        stock: parseInt(stock),
        category: {
          connect: { id: parseInt(categoryId) },
        },
        isFeatured: isFeatured === "true",
      },
    });

    await clearProductCache();

    res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not find",
      });
    }

    const deletedProduct = await prisma.product.delete({
      where: { id },
    });

    await clearProductCache();

    res.json({
      message: "Product deleted successfull",
      product: deletedProduct,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
