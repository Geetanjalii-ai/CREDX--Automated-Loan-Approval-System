import jwt from 'jsonwebtoken';

/**
 * Validates token structure and appends verified profile contexts
 */
export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'AccessDenied', 
      message: 'Authentication signature missing or malformed.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_dev_secret');
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role // Options: 'CUSTOMER' or 'BANK_MANAGER'
    };

    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Authentication credential token has expired or is invalid.' 
    });
  }
};

/**
 * Structural role check routing gates
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'UnauthorizedAccess', 
        message: 'Your system security privileges cannot execute this controller path.' 
      });
    }
    next();
  };
};