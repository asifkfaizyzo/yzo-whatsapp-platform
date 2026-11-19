// backend/src/lib/utils/http.error.js (do not remove this comment)

export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validates `data` against a zod schema.
 * Returns parsed data or throws HttpError(400) with a readable message + issue list.
 */
export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = details[0];
    const message = first
      ? first.path
        ? `${first.path}: ${first.message}`
        : first.message
      : "Validation failed";
    throw new HttpError(400, message, details);
  }
  return result.data;
}

/**
 * Sends a consistent error response.
 * Known HttpErrors keep their status/message; anything else is a 500 with a generic message.
 */
export function sendError(res, error) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.details ? { errors: error.details } : {}),
    });
  }
  console.error("[sradmin] Unhandled error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}