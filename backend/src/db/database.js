import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the directory for the database file exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database instance
export const db = new Database(config.dbPath);

// Enable WAL mode (Write-Ahead Logging) for concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize database schema and perform idempotent column migrations
export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Safe migration check for existing tables (ensure AI columns exist)
  const columns = db.pragma('table_info(logs)');
  const columnNames = columns.map(c => c.name);

  const newColumns = [
    { name: 'aiExplanation', type: 'TEXT' },
    { name: 'aiRootCause', type: 'TEXT' },
    { name: 'aiNextStep', type: 'TEXT' },
    { name: 'aiGeneratedAt', type: 'TEXT' }
  ];

  for (const col of newColumns) {
    if (!columnNames.includes(col.name)) {
      db.exec(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

// Automatically initialize schema on load
initDatabase();

export default db;
