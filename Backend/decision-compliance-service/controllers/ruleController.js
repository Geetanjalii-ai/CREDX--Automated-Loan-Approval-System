import pool from '../../shared/config/db.js';
import { cache } from '../../shared/config/cache.js';

/**
 * Returns all active underwriting constraints mapped inside the Neon database
 */
export const getActiveRules = async (req, res, next) => {
  try {
    const rulesList = await pool.query('SELECT * FROM loan_rules ORDER BY loan_type, id ASC');
    res.status(200).json({ rules: rulesList.rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a specific decision metric parameters and evicts namespaced cache targets instantly
 */
export const updateRuleThreshold = async (req, res, next) => {
  const { rule_id, target_value, is_active } = req.body;

  try {
    if (!rule_id) {
      return res.status(400).json({ error: 'ValidationError', message: 'Target rule identification token is required.' });
    }

    const updateQuery = `
      UPDATE loan_rules 
      SET comparison_value = COALESCE($1, comparison_value),
          is_active = COALESCE($2, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [target_value, is_active, rule_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Target rule configuration record not found.' });
    }

    const updatedRule = result.rows[0];

    // Option 1 Namespaced Eviction: Wipe the specific target string parameter out of Upstash
    const targetCacheKey = `rules:${updatedRule.loan_type.toLowerCase()}`;
    await cache.del(targetCacheKey);

    res.status(200).json({
      message: 'Dynamic engine threshold updated successfully. Cache synchronization synchronized.',
      ruleConfiguration: updatedRule
    });

  } catch (error) {
    next(error);
  }
};