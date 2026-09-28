import { NextResponse } from 'next/server';

/**
 * Edge-to-cloud telemetry ingest (Pi 5 → Vercel).
 * Mirrors the CBF joint envelope server-side: out-of-envelope samples are
 * rejected with 422 (same fail-closed semantics as cbf_safety.py) so a faulty
 * edge publisher can never poison the cloud ledger.
 */
const Q_LIMIT = 2.62; // tightest |q| bound across joints; per-joint table in cbf_safety.py

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.q) || body.q.length !== 4 || typeof body.seal !== 'boolean') {
    return NextResponse.json({ error: 'expected {q:[q0,q1,q2,q3], seal:boolean}' }, { status: 400 });
  }
  if (!body.q.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) {
    return NextResponse.json({ error: 'q must be finite numbers' }, { status: 400 });
  }
  const breach = (body.q as number[]).findIndex((v) => Math.abs(v) > Q_LIMIT);
  if (breach !== -1) {
    return NextResponse.json(
      { error: `q[${breach}] out of envelope (|q| > ${Q_LIMIT}) — sample discarded` },
      { status: 422 },
    );
  }
  // Persist to Firestore `telemetry` via Admin SDK (FIREBASE_SERVICE_ACCOUNT_PATH)
  // — snippet in docs/OPERATIONS.md §5. Until wired, acknowledge receipt so the
  // edge supervisor never blocks on cloud I/O.
  return NextResponse.json({ ack: true, ts: Date.now() });
}
