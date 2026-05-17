import prisma from "../config/prisma.js";
import redisClient from "../config/redis.js";
import { CACHE_TTL } from "../constants/redis.js";

export const getCategories = async (req, res) => {
  try {
    const cacheKey = `categories:all`;
    const cachedCategories = await redisClient.get(cacheKey);

    if (cachedCategories) {
      console.log("Serving categories from Redis");
      return res.status(200).json({ categories: JSON.parse(cachedCategories) });
    }

    console.log("Serving categories from DB");

    const categories = await prisma.category.findMany({
      include: { products: true },
    });

    await redisClient.set(cacheKey, JSON.stringify(categories), {
      EX: CACHE_TTL,
    });

    res.status(200).json({
      categories,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal system error", error: error.message });
  }
};
