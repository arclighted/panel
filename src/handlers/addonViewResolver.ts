/**
 * Addon slug validation.
 *
 * Pattern shared with addon identifiers: lowercase alnum, dash, ≤48 chars.
 * Kept here (rather than inline) so every consumer — the Express addon loader
 * and the Nitro /addon-assets route — validates against the same rule.
 */

/** Pattern shared with addon identifiers: lowercase alnum, dash, ≤48 chars. */
export const ADDON_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function isValidAddonSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && ADDON_SLUG_REGEX.test(slug);
}
