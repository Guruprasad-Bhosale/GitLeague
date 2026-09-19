import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const CURRENT_ENCRYPTION_VERSION = 'v1';

/**
 * Derive a 32-byte encryption key from the configured secret
 */
function deriveKey(secret: string = env.TOKEN_ENCRYPTION_SECRET): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a sensitive token using AES-256-GCM with authenticated tag
 * Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptToken(plainText: string, customSecret?: string): string {
  if (!plainText) {
    throw AppError.internal('Cannot encrypt empty token');
  }

  const key = deriveKey(customSecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${CURRENT_ENCRYPTION_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted token payload with integrity verification
 */
export function decryptToken(encryptedPayload: string, customSecret?: string): string {
  if (!encryptedPayload) {
    throw AppError.internal('Cannot decrypt empty payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4) {
    throw AppError.internal('Invalid encrypted token format');
  }

  const [version, ivHex, authTagHex, cipherHex] = parts;
  if (version !== CURRENT_ENCRYPTION_VERSION) {
    throw AppError.internal(`Unsupported token encryption version: ${version}`);
  }

  try {
    const key = deriveKey(customSecret);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw AppError.internal('Token decryption failed: authentication tag mismatch or corrupted data');
  }
}

/**
 * Generate a cryptographically secure random session token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a raw session token with SHA-256 for secure database storage
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically random OAuth state parameter for CSRF mitigation
 */
export function generateOAuthState(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}
