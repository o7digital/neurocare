import Database from "better-sqlite3";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function openStore(path, vaultKey) {
  if (!vaultKey || vaultKey.length < 32)
    throw new Error("A private vault key is required");
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS members (user_id TEXT PRIMARY KEY, role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, core_id TEXT, mode TEXT NOT NULL DEFAULT 'ai', language TEXT NOT NULL DEFAULT 'es', page TEXT NOT NULL DEFAULT '', consent_at TEXT);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL REFERENCES visitors(id), role TEXT NOT NULL, content TEXT NOT NULL, created TEXT NOT NULL, request_id TEXT UNIQUE);
    CREATE INDEX IF NOT EXISTS messages_visitor ON messages(visitor_id, created);
    CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, visitor_id TEXT UNIQUE NOT NULL REFERENCES visitors(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, interest TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '', consent_at TEXT NOT NULL, marketing_consent INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL DEFAULT '', consent_source TEXT NOT NULL, opted_in INTEGER NOT NULL DEFAULT 0, opted_out INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL, language TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, version INTEGER NOT NULL, target TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, remote_id TEXT, created TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(campaign_id, version, target, provider));
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL UNIQUE, month_key TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, bytes BLOB NOT NULL, created TEXT NOT NULL);
  `);
  const key = createHash("sha256").update(vaultKey).digest();
  const seal = (value) => {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    );
  };
  const unseal = (value) => {
    const b = Buffer.from(value, "base64"),
      decipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(b.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  };
  return {
    db,
    get(name, fallback = null) {
      const row = db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get(name);
      return row ? unseal(row.value) : fallback;
    },
    set(name, value) {
      db.prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(name, seal(value));
    },
    audit(actor, action, target) {
      db.prepare(
        "INSERT INTO audit(actor,action,target,created) VALUES (?,?,?,?)",
      ).run(actor, action, target, new Date().toISOString());
    },
    limit(id, maximum, seconds = 60) {
      const now = Date.now();
      db.prepare("DELETE FROM limits WHERE expires<?").run(now);
      const row = db
        .prepare(
          "INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
        )
        .get(hash(id), now + seconds * 1000);
      return row.count <= maximum;
    },
  };
}
