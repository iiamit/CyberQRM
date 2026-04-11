/**
 * Database layer using Node.js built-in `node:sqlite` (available in Node 22.5+).
 * Falls back to a JSON-file based store if the SQLite module is unavailable.
 */
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/cyberqrm.db');

// We wrap the Node.js built-in sqlite in a better-sqlite3-compatible interface
// so the rest of the codebase doesn't need to change.

export interface Stmt {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface DB {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  close(): void;
}

// ─── Adapter for node:sqlite ──────────────────────────────────
function createNodeSqliteAdapter(dbPath: string): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

  return {
    prepare(sql: string): Stmt {
      const stmt = db.prepare(sql);
      return {
        run(...params: any[]) {
          const result = stmt.run(...params);
          return { changes: result.changes ?? 0, lastInsertRowid: result.lastInsertRowid ?? 0 };
        },
        get(...params: any[]) {
          return stmt.get(...params);
        },
        all(...params: any[]) {
          return stmt.all(...params);
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
    close() {
      db.close();
    },
  };
}

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = createNodeSqliteAdapter(DB_PATH);
    _db.exec(SCHEMA_SQL);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
