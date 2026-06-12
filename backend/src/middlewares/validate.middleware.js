import { ZodError } from 'zod';

// =========== Validate Middleware ===========
const validate = (schema) => (req, res, next) => {

  const result = schema.safeParse({
    body:   req.body,
    params: req.params,
    query:  req.query,
    cookies: req.cookies,
  });

  if (result.success) {
    return next();
  }

  // ✅ Zod v4 uses result.error.issues not result.error.errors
  const issues = result.error.issues || result.error.errors || [];

  const errors = issues.map((e) => ({
    field:   e.path.join('.'),
    message: e.message,
  }));

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors,
  });
};

export default validate;