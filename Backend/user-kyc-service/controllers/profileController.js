import pool from '../../shared/config/db.js';
import { sanitizeInputString } from '../../shared/utils/dataMasker.js';

/**
 * Enriches basic account details with core lending metrics
 */
export const enrichProfile = async (req, res, next) => {
  const { age, gender, permanent_address, state, country } = req.body;
  const userId = req.user.id; // Extracted dynamically from our shared authenticateUser middleware

  try {
    if (!age || !gender || !permanent_address || !state || !country) {
      return res.status(400).json({ error: 'ValidationError', message: 'All profile demographic parameters are mandatory.' });
    }

    // Strict rule evaluation criteria check at ingestion stage
    if (parseInt(age, 10) < 18) {
      return res.status(403).json({ 
        error: 'EligibilityViolation', 
        message: 'Lending compliance mandates that applicants must be at least 18 years of age.' 
      });
    }

    const updateQuery = `
      UPDATE users 
      SET age = $1, gender = $2, permanent_address = $3, state = $4, country = $5, kyc_status = 'PENDING_KYC'
      WHERE id = $6 AND kyc_status = 'ACCOUNT_CREATED'
      RETURNING id, kyc_status;
    `;

    const updatedUser = await pool.query(updateQuery, [
      parseInt(age, 10),
      sanitizeInputString(gender),
      sanitizeInputString(permanent_address),
      sanitizeInputString(state),
      sanitizeInputString(country),
      userId
    ]);

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({
        error: 'StateConflict',
        message: 'Profile update rejected. Account either does not exist or has already advanced past this onboarding step.'
      });
    }

    res.status(200).json({
      message: 'Demographic onboarding requirements logged successfully. Identity verification access unlocked.',
      profileState: updatedUser.rows[0]
    });

  } catch (error) {
    next(error);
  }
};