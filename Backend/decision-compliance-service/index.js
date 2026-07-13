import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from '../shared/middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_DECISION_SERVICE || 5003;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Mount the management routers
app.use('/api/v1/admin', adminRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Decision & Compliance Management Service online on port ${PORT}`);
});