import { Redis } from "ioredis";
import { env } from "../env.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    client.on("error", (error) => {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Redis client error",
          error: error.message,
        })
      );
    });
  }
  return client;
}
