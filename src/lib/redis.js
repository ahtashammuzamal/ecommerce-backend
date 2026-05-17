import redisClient from "../config/redis.js";

export const clearProductCache = async () => {
  const allProductsKeys = await redisClient.keys("products:*");

  if (allProductsKeys.length > 0) {
    await redisClient.del(allProductsKeys);
  }

  const singleProductKeys = await redisClient.keys("product:*");
  if (singleProductKeys.length > 0) {
    await redisClient.del(singleProductKeys);
  }

  // Clear categories cache since categories include nested products
  await redisClient.del("categories:all");
};
