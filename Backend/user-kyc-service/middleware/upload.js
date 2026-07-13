import multer from 'multer';

// Configure memory storage so files are held as temporary buffers in RAM
const storage = multer.memoryStorage();

// Restrict uploads strictly to images to protect against malicious executable files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('InvalidFileType: Only image uploads (JPEG/PNG) are permitted.'), false);
  }
};

const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Cap individual files at 5MB to prevent network bloating
  }
});

// Define our specific 3-step target upload fields
export const kycUploadFields = uploadMiddleware.fields([
  { name: 'face_image', maxCount: 1 },
  { name: 'pan_image', maxCount: 1 },
  { name: 'aadhaar_image', maxCount: 1 }
]);