import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const envKey = process.env.SEEDFLIX_SECRET_KEY || process.env.SECRET_KEY;
  if (envKey && envKey.trim().length > 0) {
    cachedKey = crypto.createHash('sha256').update(envKey.trim()).digest();
    return cachedKey;
  }

  const keyFilePath = path.join(config.dataDir, '.secret_key');
  try {
    if (fs.existsSync(keyFilePath)) {
      const hex = fs.readFileSync(keyFilePath, 'utf8').trim();
      if (hex.length === 64) {
        cachedKey = Buffer.from(hex, 'hex');
        return cachedKey;
      }
    }

    const key = crypto.randomBytes(32);
    try {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(keyFilePath, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
    } catch {
      // If filesystem write fails, keep key in memory
    }
    cachedKey = key;
    return cachedKey;
  } catch {
    cachedKey = crypto.randomBytes(32);
    return cachedKey;
  }
}

/**
 * Encrypt a secret string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<cipher_hex>
 */
export function encryptSecret(plain: string | null | undefined): string | null | undefined {
  if (plain === null || plain === undefined || plain === '') {
    return plain;
  }

  if (typeof plain === 'string' && plain.startsWith(PREFIX)) {
    return plain; // Already encrypted
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error('Failed to encrypt secret:', error);
    return plain;
  }
}

/**
 * Decrypt a secret string encrypted with AES-256-GCM.
 * Returns the plaintext. If the string is not encrypted, returns it as-is for backward compatibility.
 */
export function decryptSecret(cipherText: string | null | undefined): string | null | undefined {
  if (cipherText === null || cipherText === undefined || cipherText === '') {
    return cipherText;
  }

  if (typeof cipherText !== 'string' || !cipherText.startsWith(PREFIX)) {
    return cipherText; // Legacy plaintext
  }

  try {
    const parts = cipherText.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
      return cipherText;
    }

    const [ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Failed to decrypt secret:', error);
    return cipherText;
  }
}

/**
 * Helper to reset cached key (mostly used for tests)
 */
export function _resetCachedKey(): void {
  cachedKey = null;
}
