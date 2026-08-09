type CorePermission =
  | 'server.*'
  | 'server.view'
  | 'server.start'
  | 'server.stop'
  | 'server.restart'
  | 'server.files'
  | 'server.settings'
  | 'admin.*'
  | 'arclight.admin.addons.view'
  | 'arclight.admin.addons.toggle'
  | 'arclight.admin.addons.reload'
  | 'arclight.admin.addons.store'
  | 'arclight.admin.addons.install'
  | 'arclight.admin.addons.settings'
  | 'arclight.admin.addons.commands'
  | 'arclight.admin.analytics.view'
  | 'arclight.admin.users.view'
  | 'arclight.admin.users.create'
  | 'arclight.admin.users.edit'
  | 'arclight.admin.users.delete'
  | 'arclight.admin.nodes.view'
  | 'arclight.admin.nodes.create'
  | 'arclight.admin.nodes.update'
  | 'arclight.admin.nodes.delete'
  | 'arclight.admin.servers.view'
  | 'arclight.admin.servers.create'
  | 'arclight.admin.servers.update'
  | 'arclight.admin.servers.delete'
  | 'arclight.admin.apikeys.view'
  | 'arclight.admin.apikeys.create'
  | 'arclight.admin.apikeys.delete'
  | 'arclight.admin.apikeys.edit'
  | 'arclight.admin.api.docs.view'
  | 'arclight.admin.menu.main'
  | 'arclight.admin.overview.main'
  | 'arclight.admin.overview.checkForUpdates'
  | 'arclight.admin.overview.performUpdate'
  | 'arclight.admin.playerstats.view'
  | 'arclight.admin.databases.view'
  | 'arclight.admin.databases.create'
  | 'arclight.admin.databases.delete'
  | 'arclight.admin.databases.test'
  | 'arclight.api.keys.view'
  | 'arclight.api.keys.create'
  | 'arclight.api.keys.delete'
  | 'arclight.api.keys.edit'
  | 'arclight.api.servers.read'
  | 'arclight.api.servers.create'
  | 'arclight.api.servers.update'
  | 'arclight.api.servers.delete'
  | 'arclight.api.users.read'
  | 'arclight.api.users.create'
  | 'arclight.api.users.update'
  | 'arclight.api.users.delete'
  | 'arclight.api.nodes.read'
  | 'arclight.api.nodes.create'
  | 'arclight.api.nodes.update'
  | 'arclight.api.nodes.delete'
  | 'arclight.api.settings.read'
  | 'arclight.api.settings.update'
  | 'arclight.api.images.read'
  | 'arclight.api.images.create'
  | 'arclight.api.images.update'
  | 'arclight.api.images.delete'
  | 'arclight.api.locations.read'
  | 'arclight.api.locations.create';

export type Permission = CorePermission | `addon.${string}`;

const permissions: Permission[] = [];
const addonPermissionRegistry = new Map<string, string[]>();

export function registerPermission(permission: Permission): void {
  if (!permissions.includes(permission)) {
    permissions.push(permission);
  }
}

export function registerAddonPermission(addonSlug: string, permission: string): boolean {
  const expectedNs = `addon.${addonSlug}.`;
  if (!permission.startsWith(expectedNs)) {
    logger.warn(`Addon "${addonSlug}" tried to register permission outside its namespace: "${permission}"`);
    return false;
  }

  const typed = permission as Permission;
  if (!permissions.includes(typed)) {
    permissions.push(typed);
  }

  const existing = addonPermissionRegistry.get(addonSlug) ?? [];
  if (!existing.includes(permission)) {
    existing.push(permission);
    addonPermissionRegistry.set(addonSlug, existing);
  }

  return true;
}

export function clearAddonPermissions(addonSlug: string): void {
  const perms = addonPermissionRegistry.get(addonSlug);
  if (!perms) {return;}

  for (const perm of perms) {
    const idx = permissions.indexOf(perm as Permission);
    if (idx !== -1) {permissions.splice(idx, 1);}
  }

  addonPermissionRegistry.delete(addonSlug);
}

export function hasPermission(userPerms: Permission[], required: Permission): boolean {
  return userPerms.some((perm) => {
    if (perm === required) {return true;}
    if (perm.endsWith('.*')) {
      const base = perm.slice(0, -2);
      return required.startsWith(`${base}.`);
    }
    return false;
  });
}

import logger from './logger';

registerPermission('arclight.api.keys.view');
registerPermission('arclight.api.keys.create');
registerPermission('arclight.api.keys.delete');
registerPermission('arclight.api.keys.edit');

registerPermission('arclight.api.servers.read');
registerPermission('arclight.api.servers.create');
registerPermission('arclight.api.servers.update');
registerPermission('arclight.api.servers.delete');
registerPermission('arclight.api.users.read');
registerPermission('arclight.api.users.create');
registerPermission('arclight.api.users.update');
registerPermission('arclight.api.users.delete');
registerPermission('arclight.api.nodes.read');
registerPermission('arclight.api.nodes.create');
registerPermission('arclight.api.nodes.update');
registerPermission('arclight.api.nodes.delete');
registerPermission('arclight.api.settings.read');
registerPermission('arclight.api.settings.update');
registerPermission('arclight.admin.addons.settings');
registerPermission('arclight.admin.addons.commands');
registerPermission('arclight.api.images.read');
registerPermission('arclight.api.images.create');
registerPermission('arclight.api.images.update');
registerPermission('arclight.api.images.delete');
registerPermission('arclight.api.locations.read');
registerPermission('arclight.api.locations.create');
registerPermission('arclight.admin.menu.main');

export default permissions;
