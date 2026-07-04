export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHENTICATED");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "UNAUTHORIZED");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string = "Validation failed", errors: Record<string, string[]> = {}) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = "Payload too large") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Formats an AppError into a JSON response body
 */
export function formatErrorResponse(error: AppError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && { errors: error.errors }),
    },
  };
}
