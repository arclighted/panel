/**
 * User-facing messages for the panel's redirect `err` codes.
 *
 * These mirror the message mapping in the EJS auth views (views/auth/*.ejs) so
 * migrated pages show identical copy to the legacy pages.
 */

export const LOGIN_ERRORS: Record<string, string> = {
  missing_credentials: 'Missing username or password.',
  invalid_credentials: 'Incorrect username or password.',
  incorrect_password: 'Incorrect username or password.',
  user_not_found: 'Incorrect username or password.',
  database_error: 'Server error — try again shortly.',
  session_expired: 'Your session expired. Please sign in again.',
  reset_email_sent:
    'If that email exists, a password reset link has been sent.',
  password_reset: 'Password updated. Sign in with your new password.',
  registration_disabled: 'Registration is currently disabled.',
}

export function loginErrorMessage(err: string | null | undefined): string {
  if (!err) return 'Something went wrong. Try again.'
  if (err === 'account_locked') {
    return 'Account temporarily locked. Try again in a few minutes.'
  }
  return LOGIN_ERRORS[err] ?? 'Something went wrong. Try again.'
}

export const REGISTER_ERRORS: Record<string, string> = {
  missing_credentials: 'All fields are required.',
  invalid_username: 'Username must be 3–20 characters, letters and numbers only.',
  invalid_input: 'Enter a valid email, username, and password (8+ chars, one letter, one number).',
  weak_password: 'Password needs 8+ chars, at least one letter and one number.',
  user_already_exists: 'That username or email is already taken.',
}

export function registerErrorMessage(err: string | null | undefined): string {
  if (!err) return 'Something went wrong. Try again.'
  return REGISTER_ERRORS[err] ?? 'Something went wrong. Try again.'
}

export const RESET_ERRORS: Record<string, string> = {
  missing: 'Enter a new password.',
  mismatch: 'Passwords do not match.',
  weak: 'Password must be at least 8 characters with letters and numbers.',
  expired: 'This reset link is invalid or has expired. Request a new one.',
  error: 'Something went wrong. Try again.',
}

export function resetErrorMessage(err: string | null | undefined): string {
  if (!err) return 'Something went wrong. Try again.'
  return RESET_ERRORS[err] ?? 'Something went wrong. Try again.'
}

export const FORGOT_ERRORS: Record<string, string> = {
  rate_limited: 'Too many requests. Wait an hour and try again.',
}