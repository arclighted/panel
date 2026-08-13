/**
 * Startup variable validation — the only live part of the former Express
 * startup router module. The Express route registration + res.render sites
 * were deleted in Phase 6 (the Nitro twins live at
 * web/server/routes/server/[id]/startup/* and
 * web/server/routes/api/v1/servers/[id]/startup.patch.ts).
 */
import logger from '../../../handlers/logger';
import type { ServerVariable } from './shared';

// Pterodactyl-style validation rules ("required|between:1,32|regex:/^[a-z0-9]+$/i")
export function validateVariableRules(
  variable: ServerVariable,
  value: string,
): string | null {
  const rawRules =
    variable.rules || variable.rules_field || variable.rulesField || '';
  if (typeof rawRules !== 'string' || rawRules.trim() === '') {return null;}

  const valueLabel = variable.name || variable.env;
  const rules = rawRules
    .split('|')
    .map((r) => r.trim())
    .filter(Boolean);

  for (const rule of rules) {
    if (rule === 'required') {
      if (value === '' || value === undefined || value === null) {
        return `${valueLabel} is required.`;
      }
      continue;
    }
    if (rule === 'string') {continue;}
    if (rule === 'numeric') {
      if (value !== '' && isNaN(Number(value))) {
        return `${valueLabel} must be a number.`;
      }
      continue;
    }
    if (rule.startsWith('between:')) {
      const [minStr, maxStr] = rule.slice('between:'.length).split(',');
      const min = Number(minStr);
      const max = Number(maxStr);
      if (!isNaN(min) && !isNaN(max) && value !== '') {
        const num = Number(value);
        if (isNaN(num) || num < min || num > max) {
          return `${valueLabel} must be between ${min} and ${max}.`;
        }
      }
      continue;
    }
    if (rule.startsWith('min:')) {
      const min = Number(rule.slice('min:'.length));
      if (
        !isNaN(min) &&
        value !== '' &&
        (isNaN(Number(value)) || Number(value) < min)
      ) {
        return `${valueLabel} must be at least ${min}.`;
      }
      continue;
    }
    if (rule.startsWith('max:')) {
      const max = Number(rule.slice('max:'.length));
      if (
        !isNaN(max) &&
        value !== '' &&
        (isNaN(Number(value)) || Number(value) > max)
      ) {
        return `${valueLabel} must be at most ${max}.`;
      }
      continue;
    }
    if (rule.startsWith('regex:')) {
      const rawPattern = rule.slice('regex:'.length).trim();
      const match = /^\/(.*)\/([a-z]*)$/s.exec(rawPattern);
      const pattern = match && match[1] !== undefined ? match[1] : rawPattern;
      const flags = match ? match[2] : '';
      let re: RegExp;
      try {
        re = new RegExp(pattern, flags);
      } catch {
        logger.warn(
          `Invalid regex in rules for variable ${variable.env}: ${rawPattern}`,
        );
        continue;
      }
      if (value !== '' && !re.test(value)) {
        return (
          variable.rulesMessage ||
          `${valueLabel} does not match the required pattern.`
        );
      }
      continue;
    }
    if (rule.startsWith('in:')) {
      const allowed = rule
        .slice('in:'.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(value)) {
        return `${valueLabel} must be one of: ${allowed.join(', ')}.`;
      }
    }
  }

  return null;
}
