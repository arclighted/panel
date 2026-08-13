-- Phase 9: roles, onboarding state, image approval, privileged limits
--
-- NOTE (Phase 7 dev-seam smoke): the `role`, `onboardingCompleted` and
-- `onboardingSkipped` Users columns were ALREADY created by the RedefineTables
-- in `20260809100711_new` — the original `ADD COLUMN` statements here failed
-- on fresh databases with `duplicate column name` (P3018), aborting
-- `prisma migrate deploy`. The backfill and the Images/settings ALTERs below
-- are still required, so only the redundant Users ADD COLUMNs were dropped.
UPDATE "Users" SET "role" = 'owner' WHERE "id" = (SELECT "id" FROM "Users" WHERE "isAdmin" = 1 ORDER BY "id" ASC LIMIT 1);
UPDATE "Users" SET "role" = 'admin' WHERE "isAdmin" = 1 AND "role" = 'user';

-- AlterTable
ALTER TABLE "Images" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "Images" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "Images" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN "allowPrivilegedServerLimit" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "settings" ADD COLUMN "allowPrivilegedMaxMemory" INTEGER NOT NULL DEFAULT 2048;
ALTER TABLE "settings" ADD COLUMN "allowPrivilegedMaxCpu" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "settings" ADD COLUMN "allowPrivilegedMaxStorage" INTEGER NOT NULL DEFAULT 61440;
ALTER TABLE "settings" ADD COLUMN "allowPrivilegedMaxDatabases" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "settings" ADD COLUMN "allowUserCreateImages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "onboardingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "onboardingSteps" TEXT NOT NULL DEFAULT '[]';
