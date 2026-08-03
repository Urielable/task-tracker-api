import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the project root from this file's location (src/db.ts lives one
 * directory below the root). `__dirname` is not available under ESM, so we
 * derive it from `import.meta.url`.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'tasks.db');
const schemaPath = path.join(projectRoot, 'schema.sql');
const seedPath = path.join(projectRoot, 'seed.sql');

// Ensure the data/ directory exists before opening the database file.
fs.mkdirSync(dataDir, { recursive: true });

// Open (or create) the SQLite database file.
export const db: DatabaseType = new Database(dbPath);

// Recommended pragmas for a local, single-file app.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Apply the schema on every start. `schema.sql` uses `CREATE TABLE IF NOT
 * EXISTS`, so this is safe to run repeatedly.
 */
function applySchema(): void {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

/**
 * Seed sample data, but only when the tasks table is empty. This gives a fresh
 * clone immediate data to play with without duplicating rows on restart.
 */
function seedIfEmpty(): void {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get() as {
    count: number;
  };

  if (count === 0) {
    const seed = fs.readFileSync(seedPath, 'utf-8');
    db.exec(seed);
  }
}

applySchema();
seedIfEmpty();

export default db;
