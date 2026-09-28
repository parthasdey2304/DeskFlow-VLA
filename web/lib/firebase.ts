import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export type InvoiceDoc = {
  id: string; vendor: string; total: number;
  status: 'APPROVED' | 'FLAGGED_DISCREPANCY'; ts: number;
};

function db() {
  if (!config.apiKey) return null;
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  return getFirestore(app);
}

/** Real-time listener on `invoices`; onFailure → caller keeps local snapshot. */
export function subscribeInvoices(onData: (rows: InvoiceDoc[]) => void, onFailure?: () => void) {
  try {
    const firestore = db();
    if (!firestore) { onFailure?.(); return () => {}; }
    const q = query(collection(firestore, 'invoices'), orderBy('ts', 'desc'), limit(25));
    return onSnapshot(q,
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvoiceDoc, 'id'>) }))),
      () => onFailure?.(),
    );
  } catch {
    onFailure?.();
    return () => {};
  }
}
