import Razorpay from 'razorpay';

export function razorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export const PLANS = {
  unit: { amount: 4999900, label: 'DeskFlow Unit' },      // ₹49,999 in paise
  haas: { amount: 299900, label: 'HaaS Monthly' },        // ₹2,999 in paise
} as const;
