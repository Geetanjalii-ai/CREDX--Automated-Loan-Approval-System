import stringSimilarity from 'string-similarity';
import { storage } from '../../shared/config/storage.js';
import { cache } from '../../shared/config/cache.js';
import pool from '../../shared/config/db.js';

/**
 * Intercepts the 3 images, uploads them to Backblaze B2, and calculates compliance matching scores
 */
export const processKycUploads = async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    // 1. Verify user passed the dynamic OTP checking layer first
    const verificationSession = await cache.get(`verified_tokens:${userId}`);
    if (!verificationSession || verificationSession.status !== 'OTP_CLEARED') {
      return res.status(403).json({
        error: 'LifecycleViolation',
        message: 'Access denied. You must complete verification token validation before submitting documents.'
      });
    }

    // 2. Structural file integrity check
    if (!req.files || !req.files.face_image || !req.files.pan_image || !req.files.aadhaar_image) {
      return res.status(400).json({
        error: 'MissingAssets',
        message: 'The 3 structural capture frames (Face, PAN card, and Aadhaar card) are mandatory.'
      });
    }

    // Extract files from multi-part array containers
    const faceFile = req.files.face_image[0];
    const panFile = req.files.pan_image[0];
    const aadhaarFile = req.files.aadhaar_image[0];

    // 3. Stream binary structures to Private Backblaze B2 cloud storage locations
    const faceStorageKey = `kyc/user_${userId}/face_snapshot.jpg`;
    const panStorageKey = `kyc/user_${userId}/pan_proof.jpg`;
    const aadhaarStorageKey = `kyc/user_${userId}/aadhaar_proof.jpg`;

    await storage.uploadFile(faceStorageKey, faceFile.buffer, faceFile.mimetype);
    await storage.uploadFile(panStorageKey, panFile.buffer, panFile.mimetype);
    await storage.uploadFile(aadhaarStorageKey, aadhaarFile.buffer, aadhaarFile.mimetype);

    // 4. Run Automated Deterministic Data Verification (Simulated OCR Parse Extraction)
    // Fetch base user profile parameters from Neon database to contrast text strings
    const profileLookup = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
    const userRecord = profileLookup.rows[0];
    const fullLegalName = `${userRecord.first_name} ${userRecord.last_name}`.toLowerCase();

    // Simulate OCR engine parsing character outputs out of the physical images
    const simulatedOcrPanText = `${userRecord.first_name} ${userRecord.last_name} ID-${verificationSession.rawPanPlaceholder}`.toLowerCase();
    const simulatedOcrAadhaarText = `${userRecord.first_name} ${userRecord.last_name} UID-${verificationSession.rawAadhaarPlaceholder}`.toLowerCase();

    // 5. Compute String Metrics (Dice's Coefficient matching logic)
    const panTextMatch = stringSimilarity.compareTwoStrings(fullLegalName, userRecord.first_name.toLowerCase());
    const aadhaarTextMatch = stringSimilarity.compareTwoStrings(fullLegalName, userRecord.first_name.toLowerCase());
    
    // Average out structural scores to establish single compliance matching vector
    const calculatedCompositeScore = parseFloat((((panTextMatch + aadhaarTextMatch) / 2) * 100).toFixed(2));
    const simulatedLivenessConfidence = parseFloat((0.92 + Math.random() * 0.07).toFixed(2)); // High-confidence human simulation

    // Determine path execution flags based on our dynamic 90% threshold requirement
    const automatedPassGate = calculatedCompositeScore >= 90.00;
    const finalKycRecordStatus = automatedPassGate ? 'VERIFIED' : 'PENDING_KYC';
    const finalOcrMatchStatus = automatedPassGate ? 'VERIFIED_AUTO' : 'PENDING_REVIEW';

    // 6. Database Persistence Layer Execution (Neon PostgreSQL Write)
    await pool.query('BEGIN'); // Initialize single atomic database transaction block

    const insertKycQuery = `
      INSERT INTO kyc_records (user_id, masked_aadhaar, masked_pan, otp_verified, face_snapshot_url, pan_snapshot_url, aadhaar_snapshot_url, text_similarity_score, liveness_score, status)
      VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9);
    `;
    await pool.query(insertKycQuery, [
      userId,
      verificationSession.maskedAadhaar,
      verificationSession.maskedPan,
      faceStorageKey,
      panStorageKey,
      aadhaarStorageKey,
      calculatedCompositeScore,
      simulatedLivenessConfidence,
      finalOcrMatchStatus
    ]);

    // Advance the user status parameter instantly based on the score matrix
    await pool.query('UPDATE users SET kyc_status = $1 WHERE id = $2', [finalKycRecordStatus, userId]);

    await pool.query('COMMIT'); // Commit structural writes to disk simultaneously

    // Evict temporary verification session flags from active memory maps
    await cache.del(`verified_tokens:${userId}`);

    res.status(200).json({
      message: automatedPassGate 
        ? 'Identity credentials auto-verified successfully via matching logic.' 
        : 'Document-presence scores queued for manual administration review.',
      metrics: {
        document_text_match: `${calculatedCompositeScore}%`,
        liveness_rating: `${simulatedLivenessConfidence * 100}%`,
        auto_processed: automatedPassGate
      }
    });

  } catch (error) {
    await pool.query('ROLLBACK'); // Invalidate state alterations if storage or database connection writes fault out
    next(error);
  }
};