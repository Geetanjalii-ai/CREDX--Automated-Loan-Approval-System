import pool from '../../shared/config/db.js';
import { cache } from '../../shared/config/cache.js';
import { sanitizeInputString } from '../../shared/utils/dataMasker.js';

/**
 * Validates polymorphic metadata structures based on individual loan categories.
 */
const validateLoanMetadata = (loanType, metadata) => {
  if (!metadata || typeof metadata !== 'object') return false;

  switch (loanType) {
    case 'PERSONAL':
      return (
        ['SALARIED', 'SELF_EMPLOYED'].includes(metadata.employment_type) &&
        typeof metadata.employer_name === 'string' &&
        metadata.employer_name.trim().length > 0 &&
        !isNaN(parseFloat(metadata.monthly_take_home)) &&
        parseFloat(metadata.monthly_take_home) > 0
      );

    case 'AUTO':
      return (
        ['NEW', 'PRE_OWNED'].includes(metadata.vehicle_type) &&
        typeof metadata.vehicle_make_model === 'string' &&
        metadata.vehicle_make_model.trim().length > 0 &&
        !isNaN(parseFloat(metadata.ex_showroom_price)) &&
        !isNaN(parseFloat(metadata.down_payment_funded)) &&
        parseFloat(metadata.ex_showroom_price) > 0
      );

    case 'HOME':
      return (
        ['APARTMENT', 'INDEPENDENT_VILLA', 'PLOT'].includes(metadata.property_type) &&
        typeof metadata.builder_reputation_grade === 'string' &&
        !isNaN(parseFloat(metadata.property_market_value)) &&
        !isNaN(parseFloat(metadata.built_up_area_sqft)) &&
        parseFloat(metadata.property_market_value) > 0
      );

    default:
      return false;
  }
};

/**
 * Ingests a new loan application, enforcing strict dynamic payload validation.
 */
export const createLoanApplication = async (req, res, next) => {
  const { loan_type, requested_amount, tenure_months, application_metadata } = req.body;
  const userId = req.user.id;
  const cacheKey = req.idempotencyKey;

  try {
    // 1. Basic Parameter Verification
    if (!loan_type || !requested_amount || !tenure_months || !application_metadata) {
      const errorPayload = { error: 'ValidationError', message: 'All structural parameters, including application metadata, are mandatory.' };
      if (cacheKey) await cache.set(cacheKey, errorPayload, 300);
      return res.status(400).json(errorPayload);
    }

    const cleanLoanType = sanitizeInputString(loan_type).toUpperCase();
    const amount = parseFloat(requested_amount);
    const tenure = parseInt(tenure_months, 10);

    if (!['PERSONAL', 'HOME', 'AUTO'].includes(cleanLoanType)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid loan type vertical selected.' });
    }

    // 2. Strict Sub-Schema JSONB Validation Gate
    const isMetadataValid = validateLoanMetadata(cleanLoanType, application_metadata);
    if (!isMetadataValid) {
      const metadataError = { 
        error: 'SchemaViolation', 
        message: `The application_metadata payload structure does not conform to the specifications required for a ${cleanLoanType} loan.` 
      };
      if (cacheKey) await cache.set(cacheKey, metadataError, 300);
      return res.status(400).json(metadataError);
    }

    // 3. KYC Status Verification Gate
    const userKycCheck = await pool.query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
    if (userKycCheck.rows.length === 0) {
      return res.status(404).json({ error: 'ProfileNotFound', message: 'The requesting customer identity does not exist.' });
    }

    const currentKycStatus = userKycCheck.rows[0].kyc_status;
    if (currentKycStatus !== 'VERIFIED') {
      const complianceError = {
        error: 'ComplianceViolation',
        message: `Loan processing blocked. Profile status is [${currentKycStatus}]. Complete secure KYC onboarding first.`
      };
      if (cacheKey) await cache.set(cacheKey, complianceError, 300);
      return res.status(403).json(complianceError);
    }

    // 4. Persistence Entry into Neon Cloud Ledger
    // The pg driver automatically transforms the JS Object into an optimized native JSONB string parameter
    const insertLoanQuery = `
      INSERT INTO loan_applications (user_id, loan_type, requested_amount, tenure_months, status, idempotency_key, application_metadata)
      VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, $6)
      RETURNING id, loan_type, requested_amount, tenure_months, status, application_metadata, created_at;
    `;

    const newLoanRecord = await pool.query(insertLoanQuery, [
      userId,
      cleanLoanType,
      amount,
      tenure,
      req.headers['x-idempotency-key'],
      application_metadata
    ]);

    const successResponse = {
      message: 'Dynamic loan application logged successfully.',
      application: newLoanRecord.rows[0]
    };

    if (cacheKey) {
      await cache.set(cacheKey, successResponse, 3600);
    }

    return res.status(201).json(successResponse);

  } catch (error) {
    next(error);
  }
};


/**
 * Fetches a user's loan history and translates backend rejections into consumer-friendly feedback.
 */
export const getUserApplications = async (req, res, next) => {
  const userId = req.user.id;

  try {
    // Left Join allows us to fetch the loan even if an audit log doesn't exist yet (e.g., SUBMITTED status)
    const query = `
      SELECT 
        la.id, la.loan_type, la.requested_amount, la.tenure_months, la.status, la.created_at,
        cal.evaluation_ledger
      FROM loan_applications la
      LEFT JOIN compliance_audit_logs cal ON la.id = cal.application_id
      WHERE la.user_id = $1
      ORDER BY la.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(200).json({ applications: [], message: 'No loan applications found for this profile.' });
    }

    // Process the raw database rows to make them frontend-ready
    const formattedApplications = result.rows.map(app => {
      const formattedApp = {
        application_id: app.id,
        loan_type: app.loan_type,
        requested_amount: parseFloat(app.requested_amount),
        tenure_months: app.tenure_months,
        status: app.status,
        submitted_on: app.created_at
      };

      // If the loan was rejected, parse the ledger to extract exactly which rules failed
      if (app.status === 'REJECTED' && app.evaluation_ledger) {
        let ledger = typeof app.evaluation_ledger === 'string' 
          ? JSON.parse(app.evaluation_ledger) 
          : app.evaluation_ledger;
        
        // Filter only the rules that the user failed
        const failedRules = ledger.filter(rule => rule.passed === false);
        
        // Map backend rule names to polite, consumer-facing explanations
        formattedApp.rejection_reasons = failedRules.map(rule => {
          return `Your application did not meet our baseline requirements for: ${rule.rule_name}.`;
        });

        // Fallback if it was rejected for a non-rule reason (like the Anti-Tampering scanner)
        if (formattedApp.rejection_reasons.length === 0) {
           formattedApp.rejection_reasons.push("Your application could not be verified due to discrepancies in the submitted financial documents.");
        }
      }

      return formattedApp;
    });

    res.status(200).json({
      total_applications: formattedApplications.length,
      applications: formattedApplications
    });

  } catch (error) {
    next(error);
  }
};