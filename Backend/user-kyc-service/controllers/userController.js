import bcrypt from 'bcrypt';
import pool from '../../shared/config/db.js';
import { sanitizeInputString } from '../../shared/utils/dataMasker.js';

/**
 * Creates a baseline customer profile record (CIF Generation)
 */
export const registerUser = async (req, res, next) => {
  const { first_name, last_name, email, phone, password } = req.body;

  try {
    // 1. Structural input validation
    if (!first_name || !last_name || !email || !phone || !password) {
      return res.status(400).json({ error: 'ValidationError', message: 'All registration parameters are mandatory.' });
    }

    const cleanEmail = sanitizeInputString(email).toLowerCase();
    const cleanPhone = sanitizeInputString(phone);

    // 2. Cross-reference existing records to prevent profile duplication
    const duplicateCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [cleanEmail, cleanPhone]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'ConflictError', 
        message: 'A profile using this email address or mobile identity already exists.' 
      });
    }

    // 3. Hash credentials safely using a standard work factor (12 rounds)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Write primary record to Neon PostgreSQL cluster
    // Generates masked placeholder string by default to insulate identity parameters on boot
    const insertQuery = `
      INSERT INTO users (first_name, last_name, email, phone, password_hash, kyc_status, masked_identity_proof)
      VALUES ($1, $2, $3, $4, $5, 'ACCOUNT_CREATED', 'NOT_PROVIDED')
      RETURNING id, first_name, last_name, email, phone, kyc_status;
    `;

    const newProfile = await pool.query(insertQuery, [
      sanitizeInputString(first_name),
      sanitizeInputString(last_name),
      cleanEmail,
      cleanPhone,
      hashedPassword
    ]);

    // 5. Cache response status inside Redis via request tracking parameters if needed
    res.status(201).json({
      message: 'Baseline customer registration successful.',
      profile: newProfile.rows[0]
    });

  } catch (error) {
    next(error); // Route unforeseen failures directly into our shared global error handler
  }
};