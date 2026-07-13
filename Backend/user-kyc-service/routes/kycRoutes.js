import express from 'express';
import { triggerKycOtp, verifyKycOtp } from '../controllers/otpController.js';
import { processKycUploads } from '../controllers/kycController.js';
import { kycUploadFields } from '../middleware/upload.js';
import { authenticateUser } from '../../shared/middleware/auth.js';
import { rateLimiter } from '../../shared/middleware/rateLimiter.js';

const router = express.Router();

// Apply security barriers across every downstream path container
router.use(authenticateUser);

// Secure OTP processing gates
router.post('/otp/trigger', rateLimiter(5, 60), triggerKycOtp);
router.post('/otp/verify', rateLimiter(10, 60), verifyKycOtp);

// Multi-part form-data multi-file submission handler pipeline
router.post('/upload-documents', kycUploadFields, processKycUploads);

export default router;