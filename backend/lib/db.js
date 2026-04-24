const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function initDb(databasePath, logger) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = await open({
    filename: databasePath,
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS country_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      region TEXT NOT NULL,
      avg_tone REAL NOT NULL,
      goldstein REAL NOT NULL,
      event_count INTEGER NOT NULL,
      top_themes TEXT NOT NULL,
      volatility REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_country_snapshots_region_ts
      ON country_snapshots (region, ts DESC);

    CREATE TABLE IF NOT EXISTS global_snapshots (
      ts INTEGER PRIMARY KEY,
      avg_tone REAL NOT NULL,
      goldstein REAL NOT NULL,
      event_count INTEGER NOT NULL,
      top_themes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      ts INTEGER PRIMARY KEY,
      mood REAL NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      metric TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      window TEXT NOT NULL,
      notify_webhook_url TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alert_triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id TEXT NOT NULL,
      triggered_at INTEGER NOT NULL,
      message TEXT NOT NULL,
      payload TEXT NOT NULL,
      FOREIGN KEY(rule_id) REFERENCES alerts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_alert_triggers_rule_time
      ON alert_triggers (rule_id, triggered_at DESC);
  `);

  logger.info('db', 'SQLite initialized', { databasePath });
  return db;
}

async function seedAlertRules(db, rules) {
  for (const rule of rules) {
    await db.run(
      `
        INSERT OR IGNORE INTO alerts
          (id, name, region, metric, operator, threshold, window, notify_webhook_url, active)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        rule.id,
        rule.name,
        rule.region,
        rule.metric,
        rule.operator,
        rule.threshold,
        rule.window,
        rule.notifyWebhookUrl || '',
        rule.active ? 1 : 0
      ]
    );
  }
}

module.exports = {
  initDb,
  seedAlertRules
};
