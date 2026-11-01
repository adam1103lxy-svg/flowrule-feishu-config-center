import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const CURRENT_VERSION = 'v2';
const KEY_BYTES = 32;
const MIN_SECRET_LENGTH = 32;
const KEY_DERIVATION_SALT = 'flowrule-secret-box-v2';
const LEGACY_KEY_DERIVATION_SALT = 'flowrule-salt-v1';

const readRequiredSecret = (name: string): string => {
  const value = process.env[name]?.trim() ?? '';
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} 必须配置为至少 ${MIN_SECRET_LENGTH} 个字符的部署密钥`);
  }
  return value;
};

const readLegacySecret = (): string => {
  const value = process.env.FLOWRULE_LEGACY_SECRET_BOX_PASSPHRASE?.trim() ?? '';
  if (value === '') {
    throw new Error('检测到旧版密文；请临时配置 FLOWRULE_LEGACY_SECRET_BOX_PASSPHRASE 完成一次性迁移');
  }
  return value;
};

const currentKey = (): Buffer =>
  scryptSync(readRequiredSecret('FLOWRULE_MASTER_KEY'), KEY_DERIVATION_SALT, KEY_BYTES);

const legacyKey = (): Buffer =>
  scryptSync(
    readLegacySecret(),
    LEGACY_KEY_DERIVATION_SALT,
    KEY_BYTES,
  );

export const assertSecretBoxConfiguration = (): void => {
  void currentKey();
};

export const isLegacySecretBox = (box: string): boolean =>
  box !== '' && !box.startsWith(`${CURRENT_VERSION}.`);

const decryptParts = (parts: string[], key: Buffer): string => {
  const [ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('密文格式非法');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', currentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CURRENT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

export const decryptSecret = (box: string): string => {
  const parts = box.split('.');
  if (parts[0] === CURRENT_VERSION) {
    return decryptParts(parts.slice(1), currentKey());
  }
  // 旧版密文仅在迁移窗口内可读；旧口令必须由部署方显式提供，源码不再内置。
  return decryptParts(parts, legacyKey());
};

export const migrateSecretBox = (box: string): string =>
  isLegacySecretBox(box) ? encryptSecret(decryptSecret(box)) : box;
