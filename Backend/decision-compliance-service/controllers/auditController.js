import pool from '../../shared/config/db.js';

/**
 * Retreives points-in-time compliance logs for historical accountability audits
 */
export const getApplicationAuditTrail = async (req, res, next) => {
  const { application_id } = req.params;

  try {
    const auditLogs = await pool.query(
      `SELECT cal.*, u.first_name, u.last_name 
       FROM compliance_audit_logs cal
       JOIN users u ON cal.evaluated_by_admin_id = u.id
       WHERE cal.application_id = $1
       ORDER BY cal.executed_at DESC`,
      [application_id]
    );

    if (auditLogs.rows.length === 0) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'No historical verification audit footprints recorded for this application token.'
      });
    }

    res.status(200).json({
      applicationId: application_id,
      auditHistoryCount: auditLogs.rows.length,
      logs: auditLogs.rows
    });

  } catch (error) {
    next(error);
  }
};