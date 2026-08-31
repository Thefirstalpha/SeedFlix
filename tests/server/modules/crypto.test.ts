import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../../../server/modules/crypto';

describe('crypto module', () => {
  it('should encrypt and decrypt a plaintext secret correctly', () => {
    const secret = 'my-super-secret-token-12345';
    const encrypted = encryptSecret(secret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(secret);
    expect(encrypted?.startsWith('enc:v1:')).toBe(true);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('should return null or undefined as is', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeUndefined();
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeUndefined();
    expect(decryptSecret('')).toBe('');
  });

  it('should handle unencrypted legacy plain text gracefully for backward compatibility', () => {
    const legacyPlaintext = 'plain-api-key-from-old-version';
    const result = decryptSecret(legacyPlaintext);
    expect(result).toBe(legacyPlaintext);
  });

  it('should not double-encrypt an already encrypted string', () => {
    const secret = 'another-secret';
    const encryptedOnce = encryptSecret(secret);
    const encryptedTwice = encryptSecret(encryptedOnce);
    expect(encryptedTwice).toBe(encryptedOnce);
    expect(decryptSecret(encryptedTwice)).toBe(secret);
  });

  it('should handle environment variable SECRET_KEY if defined', async () => {
    const { _resetCachedKey } = await import('../../../server/modules/crypto');
    process.env.SEEDFLIX_SECRET_KEY = 'custom-env-secret-key-for-seedflix';
    _resetCachedKey();

    const encrypted = encryptSecret('test-secret');
    expect(decryptSecret(encrypted)).toBe('test-secret');

    delete process.env.SEEDFLIX_SECRET_KEY;
    _resetCachedKey();
  });

  it('should return cipherText if parts count is invalid', () => {
    const invalidCipher = 'enc:v1:invalid-parts-only-two';
    expect(decryptSecret(invalidCipher)).toBe(invalidCipher);
  });

  it('should return cipherText if decipher throws an error on corrupted payload', () => {
    const corruptedCipher = 'enc:v1:0123456789ab:0123456789abcdef:invalidhexdata';
    expect(decryptSecret(corruptedCipher)).toBe(corruptedCipher);
  });
});

