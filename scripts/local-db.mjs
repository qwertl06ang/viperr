import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
export function createLocalDB(filename, migrationDir) {
  const sqlite = new DatabaseSync(filename); sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY);');
  for (const file of readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort()) {
    if (sqlite.prepare('SELECT name FROM _local_migrations WHERE name = ?').get(file)) continue;
    sqlite.exec('BEGIN');
    try {sqlite.exec(readFileSync(`${migrationDir}/${file}`,'utf8'));sqlite.prepare('INSERT INTO _local_migrations VALUES (?)').run(file);sqlite.exec('COMMIT');}
    catch (error) {sqlite.exec('ROLLBACK');throw error;}
  }
  return {prepare(sql) {const stmt = sqlite.prepare(sql); let params = []; return {bind(...values){params=values;return this;},async first(){return stmt.get(...params) || null;},async all(){return {results:stmt.all(...params),success:true};},async run(){const result=stmt.run(...params);return {success:true,meta:{changes:Number(result.changes)}};}};},close(){sqlite.close();}};
}
