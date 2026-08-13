import type { ApiKey, SubUser } from '../generated/prisma/client';
// Pull @types/express-session's `declare global` Request augmentation into the
// program. The session runtime (PrismaSessionStore, express-session) was pruned
// in Phase 6, so no module imports 'express-session' anymore — without this
// side-effect import, `req.session` silently loses its type.
import 'express-session';

export interface PanelSessionUser {
  id: number;
  email: string;
  isAdmin: boolean;
  username: string;
  description: string;
  role?: string;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
}

declare module 'express-session' {
  interface SessionData {
    user: PanelSessionUser;
    pendingUserId?: number;
    pendingTotpSecret?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      nonce?: string;
      lang?: string;
      translations?: Record<string, unknown>;
      cookies?: Record<string, string>;
      // Attached by isAuthenticatedForServer / isAuthenticatedForServerWS when
      // the request is made by a subuser rather than an owner or admin.
      subUser?: SubUser;
      // Attached by the validation boundary (src/utils/validation.ts) after a
      // feature-local Zod schema parses the raw request. Handlers must read
      // the parsed value, never req.body/params/query directly.
      validatedBody?: unknown;
      validatedParams?: unknown;
      validatedQuery?: unknown;
    }
  }
}

export {};
