import Database from 'better-sqlite3';
import type { AuthStore, AuthUser } from './auth.service.js';
import type { CertificationStore } from './certification.service.js';
import type { Certification } from './schema.js';

export class SqliteStore implements AuthStore, CertificationStore {
  private readonly database: Database.Database;

  constructor(path: string) {
    this.database = new Database(path);
    this.database.pragma('journal_mode = WAL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_expires_at ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS certifications (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        vendor TEXT NOT NULL,
        level TEXT NOT NULL,
        short_description TEXT NOT NULL,
        description TEXT NOT NULL,
        intended_for TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, id)
      );
      CREATE INDEX IF NOT EXISTS certifications_by_user ON certifications(user_id, created_at DESC);
    `);
    this.database.pragma('foreign_keys = ON');
  }

  createUser(user: Omit<AuthUser, 'id'> & { passwordSalt: string; passwordHash: string }): AuthUser {
    const result = this.database
      .prepare(
        'INSERT INTO users (name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(user.name, user.email, user.passwordSalt, user.passwordHash, new Date().toISOString());
    return { id: Number(result.lastInsertRowid), name: user.name, email: user.email };
  }

  findUserByEmail(email: string) {
    return this.database
      .prepare(
        'SELECT id, name, email, password_salt AS passwordSalt, password_hash AS passwordHash FROM users WHERE email = ?',
      )
      .get(email) as
      | (AuthUser & { passwordSalt: string; passwordHash: string })
      | undefined;
  }

  createSession(userId: number, tokenHash: string, expiresAt: string): void {
    this.database.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(new Date().toISOString());
    this.database.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
  }

  findUserBySession(tokenHash: string, now: string): AuthUser | undefined {
    return this.database
      .prepare(
        `SELECT users.id, users.name, users.email
         FROM auth_sessions
         JOIN users ON users.id = auth_sessions.user_id
         WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?`,
      )
      .get(tokenHash, now) as AuthUser | undefined;
  }

  deleteSession(tokenHash: string): void {
    this.database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }

  listForUser(userId: number): Certification[] {
    const rows = this.database
      .prepare(
        `SELECT id, title, vendor, level, short_description AS shortDescription,
                description, intended_for AS intendedFor, created_at AS createdAt
         FROM certifications WHERE user_id = ? ORDER BY created_at DESC, id`,
      )
      .all(userId) as Array<Omit<Certification, 'intendedFor'> & { intendedFor: string }>;

    return rows.map((row) => ({
      ...row,
      intendedFor: parseIntendedFor(row.intendedFor),
    }));
  }

  addForUser(userId: number, certification: Certification): void {
    this.database
      .prepare(
        `INSERT INTO certifications
         (user_id, id, title, vendor, level, short_description, description, intended_for, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        certification.id,
        certification.title,
        certification.vendor,
        certification.level,
        certification.shortDescription,
        certification.description,
        JSON.stringify(certification.intendedFor),
        certification.createdAt,
      );
  }

  removeForUser(userId: number, id: string): void {
    this.database.prepare('DELETE FROM certifications WHERE user_id = ? AND id = ?').run(userId, id);
  }

  close(): void {
    this.database.close();
  }
}

function parseIntendedFor(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Stored certification audience data is invalid.');
  }
  return parsed;
}
