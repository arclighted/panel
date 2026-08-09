-- Rebrand Airlink -> Arclight: rename cloud feature columns.
ALTER TABLE "settings" RENAME COLUMN "airlinkCloudApiKey" TO "arclightCloudApiKey";
ALTER TABLE "settings" RENAME COLUMN "airlinkCloudBackupEnabled" TO "arclightCloudBackupEnabled";
ALTER TABLE "Backup" RENAME COLUMN "airlinkCloudId" TO "arclightCloudId";
