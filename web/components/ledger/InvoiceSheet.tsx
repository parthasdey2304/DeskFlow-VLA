'use client';
import { useEffect } from 'react';
import type { InvoiceDoc } from '@/lib/firebase';
import { exactUtc, formatMoney, timeAgo, type Currency } from '@/lib/format';

/** Mobile-first bottom action sheet for invoice inspection. Backdrop or
 *  Escape closes; 44px+ targets throughout. */
export function InvoiceSheet({
  inv, currency, onClose,
}: {
  inv: InvoiceDoc | null;
  currency: Currency;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!inv) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [inv, onClose]);

  if (!inv) return null;
  const flagged = inv.status !== 'APPROVED';
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Invoice ${inv.id}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <section className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-2xl border border-line bg-panel p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" />
        <p className="font-mono text-[11px] tracking-[0.2em] text-zinc-500">INVOICE DETAIL</p>
        <h3 className="mt-1 text-xl font-bold text-white">{inv.id} · {inv.vendor}</h3>
        <dl className="mt-4 space-y-2 font-mono text-sm">
          <div className="flex justify-between"><dt className="text-zinc-500">Amount</dt><dd className="text-zinc-200">{formatMoney(inv.total, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Status</dt>
            <dd className={flagged ? 'text-red-300' : 'text-emerald-300'}>{inv.status}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Seen</dt>
            <dd className="text-zinc-200" title={exactUtc(inv.ts)}>{timeAgo(inv.ts)}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Exact UTC</dt><dd className="text-zinc-400 text-xs">{exactUtc(inv.ts)}</dd></div>
        </dl>
        <button onClick={onClose} className="touch-target mt-5 w-full rounded-lg bg-amber-400 font-semibold text-black">
          Close
        </button>
      </section>
    </div>
  );
}
