/**
 * Thrown by the request validators. withSupabase renders uncaught errors as
 * its own JSON error response; the check route catches this one itself so it
 * can report which field failed.
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}
