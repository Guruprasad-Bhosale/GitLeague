import { describe, it, expect } from 'vitest';
import {
  encryptToken,
  decryptToken,
  generateSecureToken,
  hashSessionToken,
  generateOAuthState,
} from '../src/lib/crypto.js';
import { AppError } from '../src/errors/app-error.js';

describe('Token Protection & Cryptographic Primitives', () => {
  const secretKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts GitHub OAuth access token successfully', () => {
    const rawToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = encryptToken(rawToken, secretKey);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.startsWith('v1:')).toBe(true);

    const decrypted = decryptToken(encrypted, secretKey);
    expect(decrypted).toBe(rawToken);
  });

  it('produces different ciphertexts and IVs for the same plaintext (random nonce)', () => {
    const rawToken = 'gho_secret_github_token_12345';
    const encrypted1 = encryptToken(rawToken, secretKey);
    const encrypted2 = encryptToken(rawToken, secretKey);

    expect(encrypted1).not.toBe(encrypted2);

    expect(decryptToken(encrypted1, secretKey)).toBe(rawToken);
    expect(decryptToken(encrypted2, secretKey)).toBe(rawToken);
  });

  it('throws AppError when attempting to decrypt tampered ciphertext (authenticated encryption integrity check)', () => {
    const rawToken = 'gho_secret_github_token';
    const encrypted = encryptToken(rawToken, secretKey);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext hex
    parts[3] = 'deadbeef' + parts[3].substring(8);
    const tamperedPayload = parts.join(':');

    expect(() => decryptToken(tamperedPayload, secretKey)).toThrow(AppError);
  });

  it('throws AppError when attempting to decrypt with incorrect secret key', () => {
    const rawToken = 'gho_secret_github_token';
    const encrypted = encryptToken(rawToken, secretKey);
    const wrongSecret = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

    expect(() => decryptToken(encrypted, wrongSecret)).toThrow(AppError);
  });

  it('throws AppError on malformed encrypted payload format', () => {
    expect(() => decryptToken('invalid-format-string', secretKey)).toThrow(AppError);
    expect(() => decryptToken('v2:a:b:c', secretKey)).toThrow(AppError);
  });

  it('generates cryptographically random 64-char hex session tokens', () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('consistently hashes session tokens with SHA-256', () => {
    const rawToken = '7f8c9b2a1d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawToken);
  });

  it('generates secure OAuth state strings', () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();

    expect(state1).toHaveLength(48);
    expect(state2).toHaveLength(48);
    expect(state1).not.toBe(state2);
  });
});
