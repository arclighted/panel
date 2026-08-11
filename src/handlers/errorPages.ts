import type { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { isProductionPosture } from '../utils/errors';

interface ErrorPageInfo {
  title: string;
  message: string;
}

const ERROR_INFO: Record<number, ErrorPageInfo> = {
  400: {
    title: 'Bad request',
    message: 'The request could not be understood by the panel.',
  },
  401: {
    title: 'Sign in required',
    message: 'Your session is missing or has expired.',
  },
  403: {
    title: 'Not your territory',
    message: 'You don\'t have access here. If that\'s wrong, your admin can fix it.',
  },
  404: {
    title: 'Fell off the map',
    message: 'This page doesn\'t exist, or it did and we broke it.',
  },
  405: {
    title: 'Method not allowed',
    message: 'This page does not support that request method.',
  },
  408: {
    title: 'Request timeout',
    message: 'The request took too long to complete.',
  },
  409: {
    title: 'Conflict',
    message: 'The request conflicts with the current panel state.',
  },
  413: {
    title: 'Payload too large',
    message: 'The uploaded data is larger than the panel accepts.',
  },
  429: {
    title: 'Too many requests',
    message: 'Slow down and try again in a moment.',
  },
  500: {
    title: 'We tripped',
    message: 'Something broke on our end. It\'s logged. We\'re probably already embarrassed.',
  },
  502: {
    title: 'Bad gateway',
    message: 'The panel could not get a valid response from an upstream service.',
  },
  503: {
    title: 'Service unavailable',
    message: 'The panel or daemon is not available right now.',
  },
  504: {
    title: 'Gateway timeout',
    message: 'An upstream service took too long to respond.',
  },
};

function wantsJson(req: Request): boolean {
  return (
    req.path.startsWith('/api/') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    req.accepts(['html', 'json']) === 'json'
  );
}

function normalizeStatus(status: unknown): number {
  const parsed = Number(status);
  if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
    return parsed;
  }
  return 500;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/**
 * Self-contained error page. No EJS, no views directory, no DB lookups — the
 * panel frontend is a React (TanStack) app, so error responses for plain-HTML
 * requests are a small inline-styled document that always renders.
 */
function renderErrorHtml(statusCode: number, info: ErrorPageInfo, detail?: string, path?: string): string {
  const statusLabel = `${statusCode} ${info.title}`;
  const safeDetail = escapeHtml(detail ?? info.message);
  const safePath = path ? escapeHtml(path) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(statusLabel)} — Arclight</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--theme-bg, #0d1117);
    color: var(--theme-text-strong, #e6edf3);
  }
  .card {
    max-width: 34rem;
    width: 100%;
    margin: 2rem;
    padding: 2.5rem;
    border-radius: 1rem;
    border: 1px solid var(--theme-border, #30363d);
    background: var(--theme-bg-secondary, #161b22);
    text-align: center;
  }
  .icon {
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 1rem;
    border: 1px solid var(--theme-border, #30363d);
    background: var(--theme-bg, #0d1117);
  }
  .icon svg { width: 1.75rem; height: 1.75rem; stroke: var(--theme-text-muted, #8b949e); }
  .label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--theme-text-muted, #8b949e); }
  h1 { margin: 0.75rem 0 0.75rem; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
  p { margin: 0 auto; max-width: 30rem; font-size: 0.875rem; line-height: 1.6; color: var(--theme-text-muted, #8b949e); }
  code {
    display: block;
    margin: 1rem auto 0;
    max-width: 28rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    word-break: break-all;
    background: var(--theme-bg, #0d1117);
    border: 1px solid var(--theme-border, #30363d);
    color: var(--theme-text-muted, #8b949e);
  }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin-top: 2rem; }
  a, button {
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    border-radius: 0.625rem;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid var(--theme-border, #30363d);
    background: var(--theme-bg, #0d1117);
    color: var(--theme-text-strong, #e6edf3);
  }
  a.primary, button.primary { background: var(--theme-accent, #2f81f7); border-color: var(--theme-accent, #2f81f7); color: #fff; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <p class="label">Error ${statusCode}</p>
    <h1>${escapeHtml(info.title)}</h1>
    <p>${safeDetail}</p>
    ${safePath ? `<code>${safePath}</code>` : ''}
    <div class="actions">
      <button type="button" onclick="history.length > 1 ? history.back() : location.assign('/')">Back</button>
      <a class="primary" href="/">Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

export async function renderErrorPage(
  req: Request,
  res: Response,
  statusCode: number,
  detail?: string,
) {
  const normalizedStatus = normalizeStatus(statusCode);
  const info = ERROR_INFO[normalizedStatus] || {
    title: `Error ${normalizedStatus}`,
    message: 'The panel could not complete this request.',
  };
  const message = detail || info.message;

  // If user is not authenticated and not requesting JSON, redirect to login
  const isAuthenticated = req.session?.user?.id;
  if (!isAuthenticated && !wantsJson(req)) {
    return res.redirect('/login');
  }

  if (wantsJson(req)) {
    return res.status(normalizedStatus).json({
      error: info.title,
      message,
      statusCode: normalizedStatus,
    });
  }

  return res
    .status(normalizedStatus)
    .send(renderErrorHtml(normalizedStatus, info, message, req.originalUrl));
}

export function notFoundHandler(req: Request, res: Response) {
  return renderErrorPage(req, res, 404);
}

export function errorPageHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = normalizeStatus(err.status || err.statusCode);
  logger.error('Unhandled error:', err);
  // Only an explicit development/debug env exposes internal detail. An unset
  // NODE_ENV is treated as production-safe so a missing .env cannot leak.
  const detail = isProductionPosture() ? undefined : err.message;
  return renderErrorPage(req, res, statusCode, detail);
}
