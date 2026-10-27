import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const MASTER_KEY = scryptSync('flowrule-feishu-secret-box-v1', 'flowrule-salt-v1', 32);

export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

export const decryptSecret = (box: string): string => {
  const [ivB64, tagB64, dataB64] = box.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('密文格式非法');
  const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};
