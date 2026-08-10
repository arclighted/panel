import { describe, it, expect } from 'vitest'

import {
  loginErrorMessage,
  registerErrorMessage,
  resetErrorMessage,
} from '@/lib/errors'

describe('loginErrorMessage', () => {
  it('maps the common credential errors to the generic message', () => {
    expect(loginErrorMessage('invalid_credentials')).toBe(
      'Incorrect username or password.',
    )
    expect(loginErrorMessage('incorrect_password')).toBe(
      'Incorrect username or password.',
    )
    expect(loginErrorMessage('user_not_found')).toBe(
      'Incorrect username or password.',
    )
  })

  it('maps reset-flow notices', () => {
    expect(loginErrorMessage('reset_email_sent')).toContain(
      'a password reset link has been sent',
    )
    expect(loginErrorMessage('password_reset')).toBe(
      'Password updated. Sign in with your new password.',
    )
  })

  it('maps session and lockout errors', () => {
    expect(loginErrorMessage('session_expired')).toContain('session expired')
    expect(loginErrorMessage('account_locked')).toContain('temporarily locked')
  })

  it('falls back for unknown codes', () => {
    expect(loginErrorMessage('nonsense')).toBe('Something went wrong. Try again.')
    expect(loginErrorMessage(null)).toBe('Something went wrong. Try again.')
  })
})

describe('registerErrorMessage', () => {
  it('maps the register error codes', () => {
    expect(registerErrorMessage('invalid_username')).toContain('3–20 characters')
    expect(registerErrorMessage('user_already_exists')).toContain('already taken')
    expect(registerErrorMessage('missing_credentials')).toBe('All fields are required.')
  })

  it('falls back for unknown codes', () => {
    expect(registerErrorMessage('zzz')).toBe('Something went wrong. Try again.')
  })
})

describe('resetErrorMessage', () => {
  it('maps the reset error codes', () => {
    expect(resetErrorMessage('mismatch')).toBe('Passwords do not match.')
    expect(resetErrorMessage('expired')).toContain('invalid or has expired')
    expect(resetErrorMessage('weak')).toContain('at least 8 characters')
  })

  it('falls back for unknown codes', () => {
    expect(resetErrorMessage('zzz')).toBe('Something went wrong. Try again.')
  })
})