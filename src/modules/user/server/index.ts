import { Router } from 'express';
import type { Module } from '../../../handlers/moduleInit';
import { registerServerContextRoutes } from './context';
import { registerConsoleRoutes } from './console';
import { registerFilesRoutes } from './files';
import { registerFileDetailRoutes } from './fileDetail';
import { registerBackupRoutes } from './backups';
import { registerSettingsRoutes } from './settings';
import { registerStartupRoutes } from './startup';
import { registerPlayersRoutes } from './players';
import { registerWorldsRoutes } from './worlds';
import { registerSubUserRoutes } from './subusers';
import { registerScheduleRoutes } from './schedules';
import { registerDatabaseRoutes } from './databases';
import { registerServerTabsRoutes } from './tabs';

const dashboardModule: Module = {
  info: {
    name: 'Server Module',
    description: 'Server management routes: console, files, backups, settings, startup, players, and worlds.',
    version: '2.0.0',
    moduleVersion: '1.0.0',
    author: 'Arclight',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    registerServerContextRoutes(router);
    registerConsoleRoutes(router);
    registerFilesRoutes(router);
    registerFileDetailRoutes(router);
    registerBackupRoutes(router);
    registerSettingsRoutes(router);
    registerStartupRoutes(router);
    registerPlayersRoutes(router);
    registerWorldsRoutes(router);
    registerSubUserRoutes(router);
    registerScheduleRoutes(router);
    registerDatabaseRoutes(router);
    registerServerTabsRoutes(router);

    return router;
  },
};

export default dashboardModule;
