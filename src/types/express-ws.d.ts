/**
 * Phase 5 — Express is deleted (src/app.ts removed), but the dormant
 * Express WS modules (src/modules/realtime, user/wsUsers, user/serverConsole)
 * still compile against `router.ws(...)`. app.ts used to activate the
 * `express-ws` type augmentation (declare module "express" — Router() returns
 * `expressWs.Router`, which carries `ws`); this bare type-only import keeps
 * that augmentation in the program without emitting any runtime import.
 */
import 'express-ws'
