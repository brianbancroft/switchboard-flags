import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiKeyValue() {
  return `sb_${randomBytes(24).toString("base64url")}`;
}

export function parseBasicAuthHeader(value: string | undefined | null) {
  if (!value?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}:${encrypted.toString("base64url")}:${authTag.toString("base64url")}`;
}

export function decrypt(encrypted: string, secret: string): string {
  const key = deriveKey(secret);
  const [ivB64, ciphertextB64, authTagB64] = encrypted.split(":");
  if (!ivB64 || !ciphertextB64 || !authTagB64) {
    throw new Error("Invalid encrypted value format");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
