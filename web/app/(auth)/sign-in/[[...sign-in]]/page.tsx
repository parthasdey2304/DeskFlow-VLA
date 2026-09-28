import { SignIn } from '@clerk/nextjs';
export default function SignInPage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-xl hairline bg-panel p-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-amber-300">OPERATOR LOGIN</p>
        <h1 className="mt-1 text-xl font-bold text-white font-display">Sign in to DeskFlow</h1>
        <div className="mt-4"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></div>
      </div>
    </main>
  );
}
