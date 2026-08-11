// Inspect users in dev.db without Prisma CLI overhead
import Database from 'better-sqlite3';
const db = new Database('/home/radityra/projects/arclight/panel/storage/dev.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log('TABLES:', tables.join(','));
const userCols = db.prepare("PRAGMA table_info(User)").all();
console.log('USER_COLS:', userCols.map(c => c.name).join(','));
const users = db.prepare("SELECT id, username, email, role FROM User").all();
console.log('USERS:', JSON.stringify(users));
