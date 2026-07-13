import { cache } from '../config/cache.js';

/**
 * Intercepts duplicate network actions to prevent processing race-conditions.
 */
export const checkIdempotency = async (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return next();
  }

  const idempotencyKey = req.headers['x-idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'IdempotencyHeaderMissing',
      message: 'X-Idempotency-Key tracker validation header token is required.'
    });
  }

  // Uses wrapper (which automatically applies 'loan_sys:')
  const cacheKey = `idempotency:${idempotencyKey}`;

  try {
    const cachedResponse = await cache.get(cacheKey);

    if (cachedResponse) {
      return res.status(409).json({
        error: 'DuplicateTransaction',
        message: 'An identical transactional request identifier has already been submitted.',
        cachedData: cachedResponse
      });
    }

    // Set lock token signature with a standard 5-minute cooldown lifecycle
    await cache.set(cacheKey, { status: 'PROCESSING', timestamp: new Date() }, 300);
    req.idempotencyKey = cacheKey;

    next();
  } catch (error) {
    console.error('Idempotency tracker validation issue, bypassing constraints safely:', error.message);
    next();
  }
};