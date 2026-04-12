import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../services/config.service.js';

interface HCaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * 获取 hCaptcha secret key
 * 优先使用环境变量 HCAPTCHA_SECRET，其次使用数据库配置 hcaptcha_secret_key
 */
function getHCaptchaSecret(): string {
  if (process.env.HCAPTCHA_SECRET) {
    return process.env.HCAPTCHA_SECRET;
  }
  return getConfig('hcaptcha_secret_key') || '';
}

/**
 * hCaptcha 验证中间件
 *
 * 验证逻辑：
 * 1. 获取 secret（环境变量优先，其次数据库配置）
 * 2. 如果 secret 为空（两个来源都无值），跳过验证
 * 3. 如果 secret 非空，要求 captcha_token：
 *    - 无 captcha_token → 400
 *    - 非生产环境 → 仅检查 token 存在（跳过服务端验证）
 *    - 生产环境 → 调用 hCaptcha API 验证
 */
export async function verifyHCaptcha(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = getHCaptchaSecret();

  // 无 secret 配置时跳过验证（数据库和环境变量都没有）
  if (!secret) {
    return next();
  }

  const { captcha_token } = req.body;

  if (!captcha_token) {
    res.status(400).json({
      success: false,
      error: '请完成验证码验证'
    });
    return;
  }

  // 非生产环境且有 secret 时，仅检查 token 存在，不验证服务端
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // 生产环境：调用 hCaptcha API 验证
  try {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        secret,
        response: captcha_token
      }).toString()
    });

    const data = await response.json() as HCaptchaResponse;

    if (!data.success) {
      console.error('hCaptcha verification failed:', data['error-codes']);
      res.status(400).json({
        success: false,
        error: '验证码验证失败'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    res.status(500).json({
      success: false,
      error: '验证码验证出错'
    });
  }
}
