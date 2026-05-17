import prisma from "../config/prisma.js";

export const getCart = async (req, res) => {
  try {
    console.log("req?.user", req?.user);

    if (!req?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: req?.user?.id },
      include: {
        cartItems: {
          orderBy: {
            id: "asc",
          },
          include: { product: { include: { category: true } } },
        },
      },
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        totalCartItems: 0,
      });
    }

    let totalCartItems = 0;
    cart.cartItems.forEach((item) => {
      totalCartItems += item.quantity;
    });

    res.status(200).json({
      success: true,
      totalCartItems,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal system error",
      message: error.message,
    });
  }
};

export const addToCart = async (req, res) => {
  try {
    // creating user cart
    let userCart;

    userCart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
    });

    if (!userCart) {
      userCart = await prisma.cart.create({
        data: {
          userId: req.user.id,
        },
      });
    }

    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        message: "productId and valid quantity required",
      });
    }

    const cartItem = await prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: userCart.id, productId: productId },
      },
      update: { quantity: { increment: quantity } },
      create: {
        cartId: userCart.id,
        productId,
        quantity,
      },
    });

    res.status(201).json({
      success: true,
      message: "Product added to cart",
      cartItem,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal system error",
      message: error.message,
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({
        message: "cartItem id missing",
      });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        cart: {
          userId: req.user.id,
        },
      },
    });

    if (!cartItem) {
      return res.status(404).json({
        message: "Cart item does not exist.",
      });
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    res.json({
      message: "Cart item successfully removed from from cart",
      cartItem,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal system error",
      error: error.message,
    });
  }
};

export const updateCart = async (req, res) => {
  try {
    const { id, action } = req.body;

    if (!id || !action) {
      return res.status(400).json({
        message: "cartItem id and action is required",
      });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id, cart: { userId: req.user.id } },
    });

    if (!cartItem) {
      return res.status(404).json({
        message: "Cart item does not exist",
      });
    }

    const { quantity } = cartItem;

    if (action === "increment") {
      await prisma.cartItem.update({
        where: { id },
        data: {
          quantity: { increment: 1 },
        },
      });
    } else if (action === "decrement" && quantity > 1) {
      await prisma.cartItem.update({
        where: { id },
        data: {
          quantity: { decrement: 1 },
        },
      });
    } else if (action === "decrement" && quantity === 1) {
      await prisma.cartItem.delete({
        where: { id },
      });
    } else {
      return res.status(400).json({
        message: "Invalid action. Action can be increment or decrement only.",
      });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { cartItems: true },
    });

    res.status(200).json({
      message: "Cart updated successfully",
      cart,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal system error",
      error: error.message,
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const cart = await prisma.cart.update({
      where: { userId: req.user.id },
      data: {
        cartItems: {
          deleteMany: {},
        },
      },
    });

    res.json({
      message: "Cart successfully cleared.",
      cart,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal system error",
      message: error.message,
    });
  }
};
