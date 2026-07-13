import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the S3 client configured specifically for Backblaze B2 endpoint structures
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  region: process.env.B2_REGION,
  forcePathStyle: true, // Mandatory structural setting for Backblaze B2 communication pipelines
});

export const storage = {
  /**
   * Uploads a raw binary or buffer file straight to the private bucket
   * @param {string} fileKey - The destination naming path (e.g., 'kyc/user_42/pan_proof.jpg')
   * @param {Buffer} fileBuffer - File binary data stream
   * @param {string} contentType - Standard mime type configuration
   */
  async uploadFile(fileKey, fileBuffer, contentType) {
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return fileKey; // Return the permanent key path identifier to be written to Neon PostgreSQL
  },

  /**
   * Generates a temporary, secure, token-authenticated access URL for human review windows
   * @param {string} fileKey - The internal storage key identifier
   * @param {number} expiresInSeconds - Expiration countdown window (default: 10 minutes)
   */
  async getSecureViewUrl(fileKey, expiresInSeconds = 600) {
    if (!fileKey) return null;

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey,
    });

    // The link will cleanly invalidate itself completely once the countdown expires
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }
};