import { createClient } from 'redis'
import dotenv from "dotenv"
dotenv.config()

const redisClient = createClient(
  process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : {
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT,
        },
      }
);

redisClient.on('connect', () => {
    console.log('Redis connection established');
})

redisClient.on('error', (err) => {
    console.log('Redis connection error', err);
})

await redisClient.connect();

export default redisClient;