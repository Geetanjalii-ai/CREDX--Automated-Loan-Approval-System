import pool from '../../shared/config/db.js';
import { cache } from '../../shared/config/cache.js';

/**
 * Compiles active underwriting policies from cache storage or primary Neon database layers
 */
const getActivePolicies = async (loanType) => {
  const cacheKey = `rules:${loanType.toLowerCase()}`;
  
  // Try Option 1 Namespaced Cache retrieval
  const cachedRules = await cache.get(cacheKey);
  if (cachedRules) return cachedRules;

  // Cache-miss: Pull rules dynamically from Neon PostgreSQL
  const dbRules = await pool.query(
    'SELECT rule_name, parameter_key, operator, comparison_value FROM loan_rules WHERE loan_type = $1 AND is_active = true',
    [loanType]
  );

  // Sync back to Upstash Redis for a 30-minute validation window
  await cache.set(cacheKey, dbRules.rows, 1800);
  return dbRules.rows;
};

/**
 * Evaluates a dataset against dynamic active policy thresholds
 */
export const evaluateBusinessRules = async (loanType, applicantData) => {
  const policies = await getActivePolicies(loanType);
  const evaluationLedger = [];
  let comprehensiveApprovalState = true;

  policies.forEach((rule) => {
    const clientValue = applicantData[rule.parameter_key];
    const targetValue = rule.comparison_value;
    let rulePassed = false;

    // Evaluate mathematical rule matrices cleanly without hardcoded values
    switch (rule.operator) {
      case '>=': rulePassed = clientValue >= targetValue; break;
      case '<=': rulePassed = clientValue <= targetValue; break;
      case '==': rulePassed = clientValue === targetValue; break;
      default: rulePassed = false;
    }

    if (!rulePassed) comprehensiveApprovalState = false;

    evaluationLedger.push({
      rule_name: rule.rule_name,
      parameter_checked: rule.parameter_key,
      applied_operator: rule.operator,
      required_threshold: targetValue,
      extracted_value: clientValue,
      passed: rulePassed
    });
  });

  return {
    approved: comprehensiveApprovalState,
    ledger_trace: evaluationLedger,
    policies_applied_count: policies.length
  };
};