import Razorpay from 'razorpay';
import { env } from './env';

export function razorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys missing — see web/.env.example');
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

export const PLANS = {
  unit: { amount: 4999900, label: 'DeskFlow Unit' },      // ₹49,999 in paise
  haas: { amount: 299900, label: 'HaaS Monthly' },        // ₹2,999 in paise
} as const;
