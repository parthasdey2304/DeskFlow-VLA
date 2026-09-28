import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay';

export async function POST(req: Request) {
  const { amount, currency = 'INR' } = await req.json();
  if (![4999900, 299900].includes(Number(amount))) {
    return NextResponse.json({ error: 'invalid plan amount' }, { status: 400 });
  }
  const order = await razorpay().orders.create({ amount, currency, receipt: `df-${Date.now()}` });
  return NextResponse.json(order);
}
