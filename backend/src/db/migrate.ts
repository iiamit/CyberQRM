import { DB } from './database';

/**
 * Runs additive migrations against an existing database.
 * Each statement is executed independently; errors are swallowed because
 * SQLite does not support "ADD COLUMN IF NOT EXISTS" — a duplicate-column
 * error simply means the migration was already applied.
 */
export function runMigrations(db: DB): void {
  const migrations: string[] = [
    // ATT&CK technique refs on TEF and Vulnerability
    `ALTER TABLE threat_event_frequencies ADD COLUMN attackTechniques TEXT DEFAULT '[]'`,
    `ALTER TABLE vulnerabilities ADD COLUMN attackTechniques TEXT DEFAULT '[]'`,

    // Multi-basis asset valuation
    `ALTER TABLE asset_values ADD COLUMN useMultipleBases INTEGER DEFAULT 0`,
    `ALTER TABLE asset_values ADD COLUMN valuationBases TEXT DEFAULT '[]'`,

    // Primary / secondary loss
    `ALTER TABLE loss_event_impacts ADD COLUMN useAdvancedLoss INTEGER DEFAULT 0`,
    `ALTER TABLE loss_event_impacts ADD COLUMN primaryLossComponents TEXT DEFAULT '[]'`,
    `ALTER TABLE loss_event_impacts ADD COLUMN slef TEXT DEFAULT NULL`,
    `ALTER TABLE loss_event_impacts ADD COLUMN secondaryLossEnabled INTEGER DEFAULT 0`,
    `ALTER TABLE loss_event_impacts ADD COLUMN secondaryLossComponents TEXT DEFAULT '[]'`,
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch (_) {
      // Column already exists — migration already applied, safe to continue.
    }
  }
}
