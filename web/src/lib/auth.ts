import { loginErrorMessage, registerErrorMessage, resetErrorMessage } from './errors'

export type AuthOutcome =
  | { type: 'success'; path: string; search?: Record<string, string> }
  | { type: 'error'; message: string }

export interface RedirectHandlerOptions {
  /** Paths that mean success (final URL pathname after redirects). */
  successPaths: string[]
  /**
   * Paths where an `err` query param means failure (e.g. '/login' for
   * /login?err=…). A path listed here WITHOUT an err param falls through to
   * the success check (register POST may land on plain /login on success).
   */
  errorPaths: string[]
  /** Map the `err` query param to a message. */
  mapError: (err: string | null) => string
  rateLimitMessage: string
}

/**
 * Pure outcome parser for redirect-based Express auth POSTs.
 *
 * The endpoints respond with 302s (e.g. POST /login → `/`, `/2fa`, or
 * `/login?err=…`). fetch with `redirect: 'follow'` follows the chain; the final
 * `response.url` reveals the outcome without any backend change.
 */
export function parseRedirectOutcome(
  finalUrlString: string,
  opts: RedirectHandlerOptions,
): AuthOutcome {
  let finalUrl: URL
  try {
    finalUrl = new URL(finalUrlString)
  } catch {
    return { type: 'error', message: 'Something went wrong. Try again.' }
  }

  // An error path WITH an err param is a failure (e.g. /login?err=…).
  if (opts.errorPaths.includes(finalUrl.pathname)) {
    const err = finalUrl.searchParams.get('err')
    if (err) {
      return { type: 'error', message: opts.mapError(err) }
    }
  }

  if (opts.successPaths.includes(finalUrl.pathname)) {
    return { type: 'success', path: finalUrl.pathname }
  }

  return { type: 'error', message: 'Something went wrong. Try again.' }
}

async function handleRedirectResponse(
  res: Response,
  opts: RedirectHandlerOptions,
): Promise<AuthOutcome> {
  if (res.status === 429) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    return { type: 'error', message: data?.error ?? opts.rateLimitMessage }
  }
  return parseRedirectOutcome(res.url, opts)
}

function postJson(
  url: string,
  body: Record<string, unknown>,
  csrfToken: string | null,
  redirect: RequestRedirect = 'follow',
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    redirect,
  })
}

export async function submitLogin(input: {
  identifier: string
  password: string
  remember: boolean
  csrfToken: string | null
}): Promise<AuthOutcome> {
  const res = await postJson('/login', {
    identifier: input.identifier,
    password: input.password,
    'remember-me': input.remember,
  }, input.csrfToken)

  return handleRedirectResponse(res, {
    successPaths: ['/', '/2fa'],
    errorPaths: ['/login'],
    mapError: loginErrorMessage,
    rateLimitMessage: 'Too many attempts. Try again in a minute.',
  })
}

export async function submitRegister(input: {
  email: string
  username: string
  password: string
  csrfToken: string | null
}): Promise<AuthOutcome> {
  const res = await postJson('/register', {
    email: input.email,
    username: input.username,
    password: input.password,
  }, input.csrfToken)

  return handleRedirectResponse(res, {
    successPaths: ['/login'],
    errorPaths: ['/register', '/login'],
    mapError: registerErrorMessage,
    rateLimitMessage: 'Too many attempts. Try again in a minute.',
  })
}

export async function submitForgotPassword(input: {
  email: string
  csrfToken: string | null
}): Promise<AuthOutcome> {
  const res = await postJson('/forgot-password', { email: input.email }, input.csrfToken)

  // The endpoint always responds the same way (never reveals whether the
  // email exists) and redirects to /login?err=reset_email_sent.
  return handleRedirectResponse(res, {
    successPaths: ['/login'],
    errorPaths: [],
    mapError: () => '',
    rateLimitMessage: 'Too many requests. Wait an hour and try again.',
  })
}

export async function submitResetPassword(input: {
  token: string
  password: string
  confirmPassword: string
  csrfToken: string | null
}): Promise<AuthOutcome> {
  const res = await postJson('/reset-password', {
    token: input.token,
    password: input.password,
    confirmPassword: input.confirmPassword,
  }, input.csrfToken)

  return handleRedirectResponse(res, {
    successPaths: ['/login'],
    errorPaths: ['/reset-password'],
    mapError: resetErrorMessage,
    rateLimitMessage: 'Too many attempts. Try again later.',
  })
}

export async function submit2FA(input: {
  token: string
  csrfToken: string | null
}): Promise<AuthOutcome> {
  // POST /2fa is the one JSON auth endpoint: { success, redirect } | { error }.
  const res = await postJson('/2fa', { token: input.token }, input.csrfToken, 'manual')
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    redirect?: string
    error?: string
  }

  if (res.ok && data.success) {
    return { type: 'success', path: data.redirect || '/' }
  }
  return { type: 'error', message: data.error || 'Invalid code. Try again.' }
}