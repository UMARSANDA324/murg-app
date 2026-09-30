const { serverError } = require('../utils/responseUtils');

/**
 * Global error handler middleware.
 * Must have 4 parameters (err, req, res, next) to work as Express error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[API_ERROR]', {
    requestId: req.requestId || null,
    endpoint: `${req.method} ${req.originalUrl}`,
    userId: req.user?.id || null,
    branchId: req.branchId || req.user?.facilityID || null,
    errorName: err.name,
    errorCode: err.code || null,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  if (err.code === 11000 || err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists.',
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  // JWT errors from middleware
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: err.errors,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  return serverError(res, process.env.NODE_ENV === 'development' ? err.message : 'Internal server error');
}

module.exports = errorHandler;
