'use client';
import type { InvoiceDoc } from '@/lib/firebase';
import { exactUtc } from '@/lib/format';
import { toast } from '@/components/ui/toaster';

/** One-click ledger export: CSV for spreadsheets, XML vouchers shaped for
 *  Tally/QuickBooks-style imports (verify mapping in your importer first). */
export function ExportButtons({ ledger }: { ledger: InvoiceDoc[] }) {
  function download(name: string, mime: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${name}`, 'ok');
  }

  function csv() {
    const rows = [
      'id,vendor,total_inr,status,timestamp_utc',
      ...ledger.map((r) =>
        [r.id, `"${r.vendor.replace(/"/g, '""')}"`, (r.total / 100).toFixed(2), r.status, exactUtc(r.ts)].join(','),
      ),
    ];
    download(`deskflow-ledger-${Date.now()}.csv`, 'text/csv', rows.join('\n'));
  }

  function xml() {
    const vouchers = ledger.map((r) => [
      '  <VOUCHER>',
      `    <ID>${r.id}</ID>`,
      `    <PARTY>${r.vendor.replace(/[<>&]/g, '')}</PARTY>`,
      `    <AMOUNT_INR>${(r.total / 100).toFixed(2)}</AMOUNT_INR>`,
      `    <STATUS>${r.status}</STATUS>`,
      `    <DATE_UTC>${exactUtc(r.ts)}</DATE_UTC>`,
      '  </VOUCHER>',
    ].join('\n')).join('\n');
    download(
      `deskflow-ledger-${Date.now()}.xml`,
      'application/xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<DESKFLOW_LEDGER count="${ledger.length}">\n${vouchers}\n</DESKFLOW_LEDGER>\n`,
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={csv} className="touch-target rounded-lg border border-line px-4 text-sm text-zinc-300 hover:border-zinc-500">CSV</button>
      <button onClick={xml} className="touch-target rounded-lg border border-line px-4 text-sm text-zinc-300 hover:border-zinc-500">XML</button>
    </div>
  );
}
