// Forward async route errors to Express's error handler
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
