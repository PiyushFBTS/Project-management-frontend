import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract a human-friendly error message from an axios error.
 *
 * The backend's HttpExceptionFilter returns:
 *   { message: 'Validation failed', errors: [ 'field X must be Y', ... ] }
 * on validation failure, so prefer `errors` (per-field detail) over the
 * generic `message`. Falls back to `fallback` when nothing usable is present.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (Array.isArray(data.errors) && data.errors.length > 0) return data.errors.join('\n');
  if (Array.isArray(data.message) && data.message.length > 0) return data.message.join('\n');
  if (typeof data.message === 'string' && data.message) return data.message;
  return fallback;
}
