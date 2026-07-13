import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import loanRoutes from './routes/loanRoutes.js';
import { errorHandler } from '../shared/middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT_LOAN_SERVICE || 5002;

// Standard Security & Body Parsing Pipelines
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Mount the domain router
app.use('/api/v1/loans', loanRoutes);

// Shared catch-all error boundary
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Loan Application Service listening actively on port ${PORT}`);
});