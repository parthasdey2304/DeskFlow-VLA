'use client';
import { useEffect, useState } from 'react';

/** Industrial toasts: dark zinc box, monospace, high-contrast status border.
 *  Usage: `import { toast, Toaster } from '@/components/ui/toaster'`,
 *  render `<Toaster />` once, call `toast('message', 'ok' | 'warn' | 'err')`. */

export type ToastKind = 'ok' | 'warn' | 'err';

type Toast = { id: number; msg: string; kind: ToastKind };

let nextId = 1;
let push: ((t: Toast) => void) | null = null;

export function toast(msg: string, kind: ToastKind = 'ok') {
  push?.({ id: nextId++, msg, kind });
}

const BORDER: Record<ToastKind, string> = {
  ok: 'border-emerald-500/40',
  warn: 'border-amber-500/40',
  err: 'border-red-500/50',
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((xs) => [...xs.slice(-3), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4200);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[min(92vw,380px)]">
      {items.map((t) => (
        <div key={t.id} className={`rounded-lg border ${BORDER[t.kind]} bg-zinc-950/95 px-3 py-2.5 font-mono text-[13px] text-zinc-200 shadow-xl`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
