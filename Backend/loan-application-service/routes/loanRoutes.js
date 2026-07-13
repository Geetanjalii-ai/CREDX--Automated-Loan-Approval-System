import express from 'express';
import { createLoanApplication, getUserApplications } from '../controllers/loanController.js';
import { authenticateUser } from '../../shared/middleware/auth.js';
import { checkIdempotency } from '../../shared/middleware/idempotency.js';
import { rateLimiter } from '../../shared/middleware/rateLimiter.js';

const router = express.Router();

// Existing Route: Submit a new application
router.post(
  '/apply',
  rateLimiter(5, 60),
  authenticateUser,
  checkIdempotency,
  createLoanApplication
);

// NEW Route: Fetch customer's own applications
router.get(
  '/my-applications',
  rateLimiter(15, 60), // Slightly higher limit for dashboard page reloads
  authenticateUser,
  getUserApplications
);

export default router;