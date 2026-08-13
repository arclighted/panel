/**
 * Backup persistence helper — the only live part of the former Express
 * backup router module. The Express route registration + res.render sites
 * were deleted in Phase 6 (the Nitro twins under
 * web/server/routes/server/[id]/backups/* are byte-identical D3 ports).
 * persistBackupRecord is called by the scheduler worker when a queued
 * backup completes.
 */
import prisma from '../../../db';

export async function persistBackupRecord(params: {
  uuid: string;
  name: string;
  serverId: string;
  filePath: string;
  size: bigint;
  checksum: string | null;
  arclightCloudId: string | null;
}): Promise<Awaited<ReturnType<typeof prisma.backup.create>>> {
  return prisma.backup.create({
    data: {
      UUID: params.uuid,
      name: params.name,
      serverId: params.serverId,
      filePath: params.filePath,
      size: params.size,
      checksum: params.checksum,
      arclightCloudId: params.arclightCloudId,
    },
  });
}
