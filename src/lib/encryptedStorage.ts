/**
 * Encrypted Local Storage
 *
 * Wraps Web Crypto API (SubtleCrypto) to encrypt/decrypt data before it
 * touches localStorage or IndexedDB.  Used for caching sensitive legal data
 * (case notes, client names, national IDs) in offline-first mode.
 *
 * Key derivation: PBKDF2 from a session-bound passphrase + random salt.
 * Encryption: AES-GCM (authenticated encryption).
 *
 * SECURITY NOTES:
 * - The derived key lives in memory only; it is never persisted.
 * - A new random salt is generated per encryption call.
 * - This protects against data extraction from rooted devices or
 *   physical device access.  It is NOT a replacement for server-side
 *   encryption (pgcrypto in Supabase).
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100_000;

/**
 * Derive an AES-GCM key from a passphrase using PBKDF2.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext string.  Returns a base64-encoded string containing
 * the salt + IV + ciphertext.
 */
export async function encrypt(
  plaintext: string,
  passphrase: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext),
  );

  // Pack: salt (16) + iv (12) + ciphertext
  const packed = new Uint8Array(
    salt.byteLength + iv.byteLength + ciphertext.byteLength,
  );
  packed.set(salt, 0);
  packed.set(iv, salt.byteLength);
  packed.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);

  // Base64-encode
  return btoa(String.fromCharCode(...packed));
}

/**
 * Decrypt a base64-encoded encrypted string back to plaintext.
 */
export async function decrypt(
  encryptedBase64: string,
  passphrase: string,
): Promise<string> {
  const packed = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0),
  );

  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const ciphertext = packed.slice(28);

  const key = await deriveKey(passphrase, salt);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Encrypted localStorage wrapper.  Stores and retrieves encrypted data
 * under a namespaced key.
 */
export const encryptedStorage = {
  /**
   * Store an encrypted value in localStorage.
   */
  async set(key: string, value: string, passphrase: string): Promise<void> {
    const encrypted = await encrypt(value, passphrase);
    localStorage.setItem(`enc:${key}`, encrypted);
  },

  /**
   * Retrieve and decrypt a value from localStorage.
   * Returns null if the key doesn't exist or decryption fails.
   */
  async get(key: string, passphrase: string): Promise<string | null> {
    const encrypted = localStorage.getItem(`enc:${key}`);
    if (!encrypted) return null;

    try {
      return await decrypt(encrypted, passphrase);
    } catch {
      // Decryption failed — data may be corrupted or passphrase changed
      return null;
    }
  },

  /**
   * Remove an encrypted value from localStorage.
   */
  remove(key: string): void {
    localStorage.removeItem(`enc:${key}`);
  },

  /**
   * Clear all encrypted entries from localStorage.
   */
  clearAll(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("enc:"));
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  },
};
