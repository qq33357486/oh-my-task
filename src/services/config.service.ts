import { getDb } from '../db/connection.js';
import type { SystemConfigMap } from '../types/index.js';

const ALLOWED_CONFIG_KEYS: Array<keyof SystemConfigMap> = [
  'server_url',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'registration_enabled',
];

export function getConfig(key: string): string | null {
  const db = getDb();
  const config = db.prepare(`
    SELECT value FROM system_config WHERE key = ?
  `).get(key) as { value: string } | undefined;
  return config?.value || null;
}

export function getAllConfig(): SystemConfigMap {
  const db = getDb();
  const configs = db.prepare(`
    SELECT key, value FROM system_config
  `).all() as Array<{ key: string; value: string }>;
  
  const result: Record<string, string> = {};
  for (const config of configs) {
    result[config.key] = config.value;
  }
  
  return {
    server_url: result.server_url || 'http://localhost:17173',
    smtp_host: result.smtp_host || '',
    smtp_port: result.smtp_port || '587',
    smtp_user: result.smtp_user || '',
    smtp_pass: result.smtp_pass || '',
    smtp_from: result.smtp_from || '',
    registration_enabled: result.registration_enabled || '1',
  };
}

export function isRegistrationEnabled(): boolean {
  const value = getConfig('registration_enabled');
  return value !== '0';
}

export function setConfig(key: string, value: string): void {
  if (!isAllowedConfigKey(key)) {
    throw new Error(`不允许修改配置项: ${key}`);
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO system_config (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

export function setMultipleConfig(configs: Partial<SystemConfigMap>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO system_config (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `);
  
  for (const [key, value] of Object.entries(configs)) {
    if (value !== undefined && isAllowedConfigKey(key)) {
      stmt.run(key, value, value);
    }
  }
}

export function isAllowedConfigKey(key: string): key is keyof SystemConfigMap {
  return ALLOWED_CONFIG_KEYS.includes(key as keyof SystemConfigMap);
}
