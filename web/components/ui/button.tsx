import * as React from 'react';
import { cn } from '@/lib/utils';

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn('touch-target inline-flex items-center justify-center rounded-lg border border-line bg-ink px-4 text-sm text-zinc-200 hover:border-zinc-500', className)}
      {...props}
    />
  );
}
