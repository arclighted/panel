import type { Request, Response } from 'express';
import type { Router } from 'express';
import { isAuthenticatedForServer, subUserHasPermission } from '../../../handlers/utils/auth/serverAuthUtil';
import { checkEulaStatus } from '../../../handlers/features';
import { checkForServerInstallation } from '../../../handlers/checkForServerInstallation';
import { getServerStatus } from '../../../handlers/utils/server/serverStatus';
import { getPrimaryExternalPort } from '../../../handlers/utils/server/ports';
import { uiComponentStore } from '../../../handlers/uiComponentHandler';
import { getImageFeatures, getServerStatusInput, loadServerPageContext } from './shared';
import logger from '../../../handlers/logger';

/**
 * Additive JSON payload for the React server shell (`/server/:uuid`).
 * Mirrors the data the EJS manage page renders server-side (server identity,
 * image features after EULA resolution, install state, initial daemon status,
 * the addon-driven server menu, and subuser permission gating) so the shell
 * never has to guess at role/feature/menu logic.
 *
 * The EJS `GET /server/:id` route is untouched.
 */

function resolveNavUrl(url: string, server: { UUID: string; id: number }): string {
  return url.replace(':uuid', server.UUID).replace(':id', String(server.id));
}

export function registerServerContextRoutes(router: Router): void {
  router.get(
    '/api/server/:id/context',
    isAuthenticatedForServer('id'),
    async (req: Request, res: Response) => {
      try {
        const context = await loadServerPageContext(req);
        if (context.status === 'missing-user') {
          res.status(404).json({ success: false, error: 'User not found.' });
          return;
        }
        if (context.status === 'missing-server') {
          res.status(404).json({ success: false, error: 'Server not found.' });
          return;
        }

        const { user, server } = context;

        let features = getImageFeatures(server.image);
        if (features.includes('eula')) {
          const eulaStatus = await checkEulaStatus(server.UUID);
          if (eulaStatus.accepted || eulaStatus.error) {
            features = features.filter((feature) => feature !== 'eula');
          }
        }

        const isSubUser = !!req.subUser;
        const isAdmin = user.isAdmin === true;
        const isOwner = server.ownerId === user.id;
        let subUserPermissions: string[] = [];
        if (req.subUser?.permissions) {
          try {
            const parsed = JSON.parse(req.subUser.permissions);
            if (Array.isArray(parsed)) {
              subUserPermissions = parsed.filter((p): p is string => typeof p === 'string');
            }
          } catch {
            subUserPermissions = [];
          }
        }

        const nav = uiComponentStore
          .getServerMenuItems()
          .filter((item) => {
            if (item.isAdminItem && !isAdmin) {return false;}
            if (item.ownerOnly && isSubUser) {return false;}
            if (item.feature && !features.includes(item.feature)) {return false;}
            if (
              isSubUser &&
              req.subUser &&
              Array.isArray(item.permissions) &&
              item.permissions.length > 0 &&
              !item.permissions.some((p) => subUserHasPermission(req.subUser!, p))
            ) {return false;}
            return true;
          })
          .sort((a, b) => b.priority - a.priority)
          .map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            url: resolveNavUrl(item.url, server),
            group: item.group ?? 'manage',
          }));

        const primaryPort = getPrimaryExternalPort(server.Ports);

        res.json({
          success: true,
          server: {
            UUID: server.UUID,
            id: server.id,
            name: server.name,
            description: server.description ?? '',
            suspended: server.Suspended,
            installing: server.Installing,
            queued: server.Queued,
            running: server.Running,
            image: server.image?.name ?? 'Unknown',
            node: {
              name: server.node?.name ?? '',
              address: server.node?.address ?? '',
            },
            primaryAddress:
              server.node?.address && primaryPort
                ? `${server.node.address}:${primaryPort}`
                : `${server.node?.address ?? ''}:?`,
            limits: {
              memory: server.Memory,
              cpu: server.Cpu,
              storage: server.Storage,
              swap: server.Swap,
            },
          },
          features,
          installed: await checkForServerInstallation(server.UUID),
          status: await getServerStatus(getServerStatusInput(server)),
          isAdmin,
          isOwner,
          isSubUser,
          subUserPermissions,
          nav,
        });
      } catch (error) {
        logger.error('Error loading server context API data:', error);
        res.status(500).json({ success: false, error: 'Failed to load server.' });
      }
    },
  );
}
