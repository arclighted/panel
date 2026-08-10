/**
 * Onboarding actions against the existing Express /onboarding endpoints.
 * POSTs are CSRF-guarded and never reject: the caller always dismisses the
 * dialog regardless of outcome (the tutorial is non-critical). The page owns
 * dashboard invalidation, so a failed skip refetches with `needsOnboarding`
 * still true and the tutorial re-shows on the next visit — matching EJS.
 */

async function post(path: string, csrfToken: string | null): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}) },
      credentials: 'same-origin',
    })
  } catch {
    // Network failure — the caller dismisses regardless.
  }
}

export function skipOnboarding(csrfToken: string | null): Promise<void> {
  return post('/onboarding/skip', csrfToken)
}

export function completeOnboarding(csrfToken: string | null): Promise<void> {
  return post('/onboarding/complete', csrfToken)
}
