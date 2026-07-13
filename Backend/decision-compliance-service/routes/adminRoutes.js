import express from 'express';
import { evaluateLoanRisk } from '../controllers/riskController.js';
import { getActiveRules, updateRuleThreshold } from '../controllers/ruleController.js';
import { getApplicationAuditTrail } from '../controllers/auditController.js';
import { authenticateUser, authorizeRoles } from '../../shared/middleware/auth.js';

const router = express.Router();

// Universal security block across administrative action tracks
router.use(authenticateUser);
router.use(authorizeRoles('BANK_MANAGER', 'COMPLIANCE_OFFICER'));

// Track A: Underwriting Evaluation & Explicit Risk Scoring Pipelines
router.post('/evaluate-risk', evaluateLoanRisk);

// Track B: Dynamic Rules Settings Management (CRUD Engine switches)
router.get('/rules', getActiveRules);
router.put('/rules/update', updateRuleThreshold);

// Track C: Historical Audits & Regulatory Trace Inspections
router.get('/audit/:application_id', getApplicationAuditTrail);

export default router;