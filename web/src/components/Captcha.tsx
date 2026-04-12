import { useRef, useCallback } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

const SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001';

// eslint-disable-next-line react-refresh/only-export-components
export function resetCaptcha(captchaRef: React.RefObject<HCaptcha | null>) {
  captchaRef.current?.resetCaptcha();
}

export default function Captcha({ onVerify, onExpire }: CaptchaProps) {
  const captchaRef = useRef<HCaptcha>(null);

  const handleVerify = useCallback((token: string) => {
    onVerify(token);
  }, [onVerify]);

  const handleExpire = useCallback(() => {
    onExpire?.();
  }, [onExpire]);

  if (!SITEKEY) {
    return null;
  }

  return (
    <div className="captcha-container">
      <HCaptcha
        ref={captchaRef}
        sitekey={SITEKEY}
        onVerify={handleVerify}
        onExpire={handleExpire}
        languageOverride="zh"
        theme="dark"
      />
    </div>
  );
}
