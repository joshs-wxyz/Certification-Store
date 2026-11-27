import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface StoredUser extends AuthUser {
  passwordSalt: string;
  passwordHash: string;
}

export interface AuthStore {
  createUser(user: Omit<AuthUser, 'id'> & { passwordSalt: string; passwordHash: string }): AuthUser;
  findUserByEmail(email: string): StoredUser | undefined;
  createSession(userId: number, tokenHash: string, expiresAt: string): void;
  findUserBySession(tokenHash: string, now: string): AuthUser | undefined;
  deleteSession(tokenHash: string): void;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email or password is incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

export class AuthService {
  static readonly sessionCookieName = 'cs_session';
  static readonly sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

  constructor(private readonly store: AuthStore) {}

  async register(input: z.infer<typeof RegisterSchema>): Promise<{ user: AuthUser; token: string }> {
    const email = input.email.toLowerCase();
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(input.password, passwordSalt);

    try {
      const user = this.store.createUser({ name: input.name, email, passwordSalt, passwordHash });
      return { user, token: this.createSession(user.id) };
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  async login(input: z.infer<typeof LoginSchema>): Promise<{ user: AuthUser; token: string }> {
    const stored = this.store.findUserByEmail(input.email.toLowerCase());
    if (!stored) {
      await hashPassword(input.password, 'certification-store-invalid-account-salt');
      throw new InvalidCredentialsError();
    }

    const candidate = Buffer.from(await hashPassword(input.password, stored.passwordSalt), 'hex');
    const expected = Buffer.from(stored.passwordHash, 'hex');
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      throw new InvalidCredentialsError();
    }

    return { user: publicUser(stored), token: this.createSession(stored.id) };
  }

  currentUser(token: string | undefined): AuthUser | undefined {
    if (!token) return undefined;
    return this.store.findUserBySession(hashToken(token), new Date().toISOString());
  }

  logout(token: string | undefined): void {
    if (token) this.store.deleteSession(hashToken(token));
  }

  private createSession(userId: number): string {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + AuthService.sessionMaxAgeSeconds * 1000).toISOString();
    this.store.createSession(userId, hashToken(token), expiresAt);
    return token;
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user: AuthUser): AuthUser {
  return { id: user.id, name: user.name, email: user.email };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}
