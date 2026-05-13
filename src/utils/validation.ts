const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(email);
}

/**
 * 标准化邮箱（小写）
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 清理用户输入
 */
export function sanitizeInput(input: string): string {
  return input.trim();
}
