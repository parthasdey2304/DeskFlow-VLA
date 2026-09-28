'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

declare global { interface Window { Razorpay: new (o: object) => { open(): void }; } }

export function CheckoutButton({ amount, label }: { amount: number; label: string }) {
  const router = useRouter();
  useEffect(() => {
    if (document.getElementById('razorpay-checkout-js')) return; // one tag per page, not per button
    const s = document.createElement('script');
    s.id = 'razorpay-checkout-js';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.body.appendChild(s);
    return () => { document.getElementById('razorpay-checkout-js')?.remove(); };
  }, []);

  async function pay() {
    if (!window.Razorpay) {
      console.error('Razorpay checkout.js failed to load — check network/ad-blocker and retry.');
      return;
    }
    const orderRes = await fetch('/api/razorpay/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'INR' }),
    }).then((r) => r.json());
    if (orderRes.error || !orderRes.id) {
      console.error('Order creation failed:', orderRes.error ?? orderRes);
      return;
    }
    const rzp = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: orderRes.id,
      name: 'DeskFlow-VLA',
      description: label,
      theme: { color: '#fbbf24' },
      handler: async (resp: object) => {
        const result = await fetch('/api/razorpay/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resp),
        }).then((r) => r.json());
        if (!result.verified) {
          console.error('Payment verification failed — no license issued.');
          return;
        }
        router.push('/dashboard#ledger');
      },
    });
    rzp.open();
  }

  return (
    <button onClick={pay} className="touch-target rounded-lg bg-amber-400 px-4 text-sm font-semibold text-black">
      {label}
    </button>
  );
}
