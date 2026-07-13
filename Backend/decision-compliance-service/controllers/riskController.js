import pool from '../../shared/config/db.js';
import { fetchMockCreditProfile, fetchMockStatementLedger } from '../services/mockFinancialData.js';
import { verifyStatementIntegrity } from '../services/financialScanner.js';
import { evaluateBusinessRules } from '../services/dynamicEngine.js';

/**
 * Calculates a weighted credit risk score (0-100 scale) incorporating dynamic metadata parameters
 */
const calculateFinancialRiskRating = (creditProfile, scannerResult, application) => {
  const creditScore = creditProfile.credit_score;
  const monthlyOutflow = parseFloat(creditProfile.monthly_emi_outflow);
  const delinquencies = creditProfile.delinquencies_24_months;
  const meta = application.application_metadata;
  
  // Choose the safest baseline income metric: evaluate declared take-home versus forensic statements
  let monthlyIncome = scannerResult.average_monthly_income;
  if (application.loan_type === 'PERSONAL' && meta.monthly_take_home) {
    // Take the conservative minimum to safeguard against income exaggeration fraud
    monthlyIncome = Math.min(monthlyIncome, parseFloat(meta.monthly_take_home));
  }

  // 1. Credit Score Component (Weight: 40%)
  const creditComponent = (creditScore / 850) * 40;

  // 2. Debt-to-Income (DTI) Component (Weight: 40%)
  let dtiComponent = 40;
  if (monthlyIncome > 0) {
    const dtiRatio = monthlyOutflow / monthlyIncome;
    dtiComponent = Math.max(0, 40 - (dtiRatio * 100));
  }

  // 3. Collateral Security Component (Weight: 20%)
  // Secured assets lower the bank's overall default loss liability, yielding higher base scores
  let collateralComponent = 0;
  if (application.loan_type === 'AUTO' && meta.ex_showroom_price) {
    const ltvRatio = parseFloat(application.requested_amount) / parseFloat(meta.ex_showroom_price);
    collateralComponent = ltvRatio <= 0.80 ? 20 : 10; // Better rating given for larger down-payments
  } else if (application.loan_type === 'HOME' && meta.property_market_value) {
    const ltvRatio = parseFloat(application.requested_amount) / parseFloat(meta.property_market_value);
    const brandMultiplier = meta.builder_reputation_grade === 'TIER_1' ? 1.0 : 0.8;
    collateralComponent = ltvRatio <= 0.75 ? (20 * brandMultiplier) : (12 * brandMultiplier);
  } else {
    // Unsecured Personal loans default to zero collateral buffering metrics
    collateralComponent = 0;
  }

  // 4. Delinquency Penalty Deduction
  const delinquencyPenalty = delinquencies * 30;

  const rawScore = creditComponent + dtiComponent + collateralComponent - delinquencyPenalty;
  return parseFloat(Math.min(Math.max(rawScore, 0), 100).toFixed(2));
};

/**
 * Executes underwriting evaluation, cross-checking metadata elements against rule specifications
 */
export const evaluateLoanRisk = async (req, res, next) => {
  const { application_id } = req.body;
  const adminId = req.user.id;

  try {
    if (!application_id) {
      return res.status(400).json({ error: 'ValidationError', message: 'Target application ID parameter is required.' });
    }

    // la.* automatically captures our application_metadata JSONB field mapping
    const appLookup = await pool.query(
      'SELECT la.*, u.masked_identity_proof, u.kyc_status FROM loan_applications la JOIN users u ON la.user_id = u.id WHERE la.id = $1',
      [application_id]
    );

    if (appLookup.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Target loan record does not exist.' });
    }

    const application = appLookup.rows[0];

    // Ingest data components from third-party system simulators
    const creditProfile = await fetchMockCreditProfile(application.masked_identity_proof);
    const statementLedger = await fetchMockStatementLedger(application.user_id);
    const scannerResult = verifyStatementIntegrity(statementLedger);

    if (!scannerResult.is_authentic) {
      await pool.query('UPDATE loan_applications SET status = \'REJECTED\' WHERE id = $1', [application_id]);
      return res.status(422).json({ error: 'ForensicFailure', message: 'Statement validation checks caught mathematical manipulation discrepancies.' });
    }

    // Call our updated risk algorithm incorporating dynamic asset parameters
    const compositeRiskScore = calculateFinancialRiskRating(creditProfile, scannerResult, application);

    const compositeMetrics = {
      credit_score: creditProfile.credit_score,
      existing_debts: creditProfile.total_active_loans,
      monthly_inflow: scannerResult.average_monthly_income,
      requested_amount: parseFloat(application.requested_amount),
      computed_risk_score: compositeRiskScore
    };

    const ruleEvaluation = await evaluateBusinessRules(application.loan_type, compositeMetrics);
    
    // Auto-approve criteria requires passing structural business rules AND hitting safe risk thresholds
    const passedUnderwritingGate = ruleEvaluation.approved && compositeRiskScore >= 60.00;
    const finalResolution = passedUnderwritingGate ? 'APPROVED' : 'REJECTED';

    await pool.query('BEGIN');

    await pool.query('UPDATE loan_applications SET status = $1 WHERE id = $2', [finalResolution, application_id]);

    const activeRulesState = await pool.query('SELECT * FROM loan_rules WHERE loan_type = $1 AND is_active = true', [application.loan_type]);
    
    await pool.query(`
      INSERT INTO compliance_audit_logs (application_id, evaluated_by_admin_id, rules_snapshot, input_data_snapshot, evaluation_ledger, final_decision)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [
      application_id,
      adminId,
      JSON.stringify(activeRulesState.rows),
      JSON.stringify(compositeMetrics),
      JSON.stringify(ruleEvaluation.ledger_trace),
      finalResolution
    ]);

    await pool.query('COMMIT');

    res.status(200).json({
      message: `Underwriting sequence processing finalized. Decision: ${finalResolution}`,
      decision: finalResolution,
      metrics: {
        composite_risk_rating: `${compositeRiskScore}/100`,
        rules_passed: ruleEvaluation.approved
      },
      trace: ruleEvaluation.ledger_trace
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
};