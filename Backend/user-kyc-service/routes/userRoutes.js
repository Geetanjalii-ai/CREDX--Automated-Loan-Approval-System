import express from 'express';
import { registerUser } from '../controllers/userController.js';
import { enrichProfile } from '../controllers/profileController.js';
import { authenticateUser } from '../../shared/middleware/auth.js';
import { rateLimiter } from '../../shared/middleware/rateLimiter.js';

const router = express.Router();

// Public route to initiate registration — heavily rate-limited against automation script flooding
router.post('/register', rateLimiter(10, 60), registerUser);

// Protected route to update extended profiles
router.put('/profile/enrich', authenticateUser, enrichProfile);

export default router;