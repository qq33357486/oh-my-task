import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * 哈希密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 验证密码强度
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码至少 8 位');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码需要包含大写字母');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码需要包含小写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码需要包含数字');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
