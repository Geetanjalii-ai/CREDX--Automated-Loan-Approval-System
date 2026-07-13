import { cache } from '../config/cache.js';

/**
 * Distributed, Redis-backed sliding-window rate limiter.
 * Protects entry endpoints from structural request flooding.
 */
export const rateLimiter = (maxRequests = 60, windowSeconds = 60) => {
  return async (req, res, next) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown_ip';
    
    // Explicit tracking key schema using namespaced scopes
    const redisClient = cache.getInstance();
    const rateLimitKey = `loan_sys:ratelimit:${clientIp}:${req.originalUrl}`;

    try {
      // Atomically increment the request count for this client profile
      const requests = await redisClient.incr(rateLimitKey);

      if (requests === 1) {
        // First entry activation sets window countdown execution properties
        await redisClient.expire(rateLimitKey, windowSeconds);
      }

      if (requests > maxRequests) {
        return res.status(429).json({
          error: 'TooManyRequests',
          message: `API allocation limit exceeded. Please wait ${windowSeconds} seconds before trying again.`,
          limit: maxRequests,
          window: `${windowSeconds}s`
        });
      }

      next();
    } catch (error) {
      console.error('⚠️ Rate limiter processing issue, bypassing constraints safely:', error.message);
      next();
    }
  };
};