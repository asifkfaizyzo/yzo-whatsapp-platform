// backend/src/utils/response.js (do not remove this comment)

/**
 * Standardized API response helpers.
 * Every controller should use these instead of manual res.json() calls.
 *
 * Response shape (matches existing frontend expectations):
 *   Success: { success: true, message: string, data: any }
 *   Error:   { success: false, message: string }
 */

export const success = (res, data = null, message = "Success", statusCode = 200) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

export const error = (res, message = "Something went wrong", statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message });
};

/**
 * For validation errors that return field-level details.
 * Format: { success: false, message: string, errors: [{ field, message }] }
 */
export const validationError = (res, errors, message = "Validation failed") => {
  return res.status(422).json({ success: false, message, errors });
};