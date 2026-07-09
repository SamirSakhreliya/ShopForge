import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Shared Redis client (ioredis).
 * Used for the public product catalogue cache (see Product.Service.ts).
 * Reads: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD from .env.
 *
 * Connection failures are logged but never thrown — catalogue reads must
 * degrade gracefully to a direct DB query if Redis is unavailable (see
 * getCached/setCached helpers in Product.Service.ts).
 */
export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});

redis.on('error', (err: Error) => {
  console.error('[Redis] connection error:', err.message);
});
