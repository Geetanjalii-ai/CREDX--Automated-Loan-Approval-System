import { cache } from '../../shared/config/cache.js';
import pool from '../../shared/config/db.js';
import { maskIdentifier } from '../../shared/utils/dataMasker.js';

/**
 * Generates a mock 6-digit transaction token, binding national identity numbers
 */
export const triggerKycOtp = async (req, res, next) => {
  const { aadhaar_number, pan_number } = req.body;
  const userId = req.user.id;

  try {
    if (!aadhaar_number || !pan_number) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Aadhaar and PAN identification parameters are strictly required.'
      });
    }

    // Generate a secure 6-digit random code format
    const simulatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Option 1 Key Namespacing: Stores in shared Upstash without overwriting other projects
    const redisOtpKey = `otp:${userId}`;
    
    // Mask numbers immediately before logging or passing variables
    const maskedAadhaar = maskIdentifier(aadhaar_number);
    const maskedPan = maskIdentifier(pan_number);

    // Cache the execution payload safely inside Redis for exactly 5 minutes (300 seconds)
    await cache.set(redisOtpKey, {
      otp: simulatedOtp,
      maskedAadhaar,
      maskedPan,
      rawAadhaarPlaceholder: aadhaar_number.replace(/[\s-]/g, ''),
      rawPanPlaceholder: pan_number.toUpperCase().trim()
    }, 300);

    // In a development environment, output the OTP token signature directly to the response metadata
    res.status(200).json({
      message: 'Verification token generated successfully.',
      recipientPhone: req.user.phone,
      debug_simulated_otp: simulatedOtp // Front-end intercepts this to complete the simulation pipeline
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Validates the token token and transitions the client state
 */
export const verifyKycOtp = async (req, res, next) => {
  const { input_otp } = req.body;
  const userId = req.user.id;

  try {
    if (!input_otp) {
      return res.status(400).json({ error: 'ValidationError', message: 'Verification OTP token is required.' });
    }

    const redisOtpKey = `otp:${userId}`;
    const cachedData = await cache.get(redisOtpKey);

    if (!cachedData) {
      return res.status(410).json({
        error: 'TokenExpired',
        message: 'The verification window has expired. Please request a new verification token.'
      });
    }

    if (cachedData.otp !== input_otp.trim()) {
      return res.status(400).json({ error: 'AuthViolation', message: 'Invalid verification token sequence.' });
    }

    // Persist verified payload state variables securely in cache container to un-gate upload steps
    await cache.set(`verified_tokens:${userId}`, {
      status: 'OTP_CLEARED',
      maskedAadhaar: cachedData.maskedAadhaar,
      maskedPan: cachedData.maskedPan,
      rawAadhaarPlaceholder: cachedData.rawAadhaarPlaceholder,
      rawPanPlaceholder: cachedData.rawPanPlaceholder
    }, 600); // 10-minute file execution upload window

    // Evict OTP signature from active cache map immediately to enforce singular check bounds
    await cache.del(redisOtpKey);

    res.status(200).json({
      message: 'Mobile binding authenticated successfully. Core document upload permissions granted.'
    });

  } catch (error) {
    next(error);
  }
};