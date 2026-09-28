/** Server-side env: secrets live here, validated once at startup with Zod.
 *  Missing keys degrade gracefully (local snapshots / stubs) but are LOUD:
 *  every gap prints a banner so silent misconfiguration is impossible.
 *  NEVER import this module from client components — use env-client.ts. */
import { z } from 'zod';

const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  LICENSE_SIGNING_SECRET: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function load(): { env: ServerEnv; missing: string[] } {
  const parsed = serverSchema.safeParse(process.env);
  const env = parsed.success ? parsed.data : {};
  const missing = (Object.keys(serverSchema.shape) as (keyof ServerEnv)[])
    .filter((k) => !env[k]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    console.error(
      `[deskflow:env] MISSING server keys (degraded mode): ${missing.join(', ')}.\n` +
      'Copy web/.env.example to .env.local and fill them.',
    );
  }
  return { env, missing };
}

const { env, missing } = load();
export { env, missing };
