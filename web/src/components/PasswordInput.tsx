import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

export default function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? '隐藏密码' : '显示密码';

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-controls={id}
        className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible(value => !value)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
