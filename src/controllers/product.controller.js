import prisma from "../config/prisma.js";
import { isValidUpdate } from "../utils/isValidUpdate.js";
import { uploadBuffer } from "../utils/uploadToCloudinary.js";

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

    const where = {
      ...searchFilter,
      ...categoryFilter,
      ...priceFilter,
    };

    const orderBy = {
      [sortBy]: order === "desc" ? "desc" : "asc",
    };

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    const take = pageSize;
    const skip = (pageNumber - 1) * pageSize;

    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        category: true,
      },
    });

    const total = await prisma.product.count({ where });

    res.json({
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
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product does not exists.",
      });
    }

    res.status(200).json({
      message: "Products fetch sucessfully",
      product,
    });
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
