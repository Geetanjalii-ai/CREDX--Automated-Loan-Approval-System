export const errorHandler = (err, req, res, next) => {
  const code = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[SYSTEM ERROR] [${req.method}] ${req.url} - Error Trace: ${err.message}`);
  
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  res.status(code).json({
    error: err.name || 'InternalSystemDiscrepancy',
    message: err.message || 'A technical exception occurred processing core bank records.',
    code,
    timestamp: new Date().toISOString()
  });
};