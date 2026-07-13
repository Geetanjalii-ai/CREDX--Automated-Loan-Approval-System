import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import { errorHandler } from '../shared/middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_USER_SERVICE || 5001;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Mount localized base routers
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/kyc', kycRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`📶 User & KYC Microservice live on port ${PORT}`);
});