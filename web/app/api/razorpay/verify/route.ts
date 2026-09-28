import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { razorpay } from '@/lib/razorpay';

/** Allow-listed amounts (paise) → license plan. Source of truth is the
 *  settled Razorpay order, never client input. */
const PLANS_BY_AMOUNT: Record<number, 'unit' | 'haas'> = {
  4999900: 'unit', // DeskFlow Unit ₹49,999
  299900: 'haas', // HaaS Monthly ₹2,999
};

function signLicense(payload: string): string {
  const secret = process.env.LICENSE_SIGNING_SECRET || process.env.RAZORPAY_KEY_SECRET!;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function POST(req: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(body).digest('hex');
  const ok =
    expected.length === String(razorpay_signature).length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
  if (!ok) return NextResponse.json({ verified: false }, { status: 400 });

  // Resolve the plan from the settled order (not from the client).
  let plan: 'unit' | 'haas' | 'unresolved' = 'unresolved';
  try {
    const order = await razorpay().orders.fetch(razorpay_order_id);
    plan = PLANS_BY_AMOUNT[Number((order as { amount: number }).amount)] ?? 'unresolved';
  } catch {
    plan = 'unresolved';
  }

  const issued_at = Date.now();
  const payload = [razorpay_order_id, razorpay_payment_id, plan, issued_at].join('|');
  const license = {
    order_id: razorpay_order_id,
    payment_id: razorpay_payment_id,
    plan,
    issued_at,
    signature: signLicense(payload),
  };
  // Persist to Firestore `licenses` (doc id = owner's uid) via the Admin SDK
  // with FIREBASE_SERVICE_ACCOUNT_PATH — snippet in docs/OPERATIONS.md §5.
  // Rules in firestore.rules deny client writes, so this server route is the
  // only writer path.
  return NextResponse.json({ verified: true, license });
}
