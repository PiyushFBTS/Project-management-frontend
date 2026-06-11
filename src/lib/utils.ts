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
/**
 * Capitalise the first character of a string. Used on free-text label
 * fields (project / phase / ticket name) so a list doesn't mix lowercase
 * "task 1" with capitalised "Task 2". Only the first char is touched —
 * acronyms and proper nouns elsewhere in the string are preserved.
 */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  const first = s[0];
  const upper = first.toUpperCase();
  return first === upper ? s : upper + s.slice(1);
}

/**
 * Derive a default Project Code from the project's Name.
 *
 * Rule (agreed with the client 2026-06-12):
 *   - Trim + count letters (ignoring whitespace).
 *   - **≤ 5 letters**: take the whole name uppercased + spaces stripped.
 *       `fbts` → `FBTS`, `Oam` → `OAM`, `Aaaaa` → `AAAAA`.
 *   - **> 5 letters**: take the first letter of each word uppercased.
 *       `Aaa Bbbb` → `AB`, `Thirdwave Coffee` → `TC`,
 *       `Bittoo Tikki Wala` → `BTW`.
 *
 * The new-project form auto-fills the Code as the user types the
 * Name, until the user manually edits the Code field — at that point
 * the auto-derive stops respecting Name changes.
 */
export function deriveProjectCode(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const letterCount = trimmed.replace(/\s+/g, '').length;
  if (letterCount <= 5) {
    return trimmed.replace(/\s+/g, '').toUpperCase();
  }
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (!data) return err?.message ?? fallback;
  if (Array.isArray(data.errors) && data.errors.length > 0) return data.errors.join('\n');
  if (Array.isArray(data.message) && data.message.length > 0) return data.message.join('\n');
  if (typeof data.message === 'string' && data.message) return data.message;
  return fallback;
}
