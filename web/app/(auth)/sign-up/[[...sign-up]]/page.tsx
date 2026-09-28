import { SignUp } from '@clerk/nextjs';
export default function SignUpPage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-xl hairline bg-panel p-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-amber-300">NEW WORKSTATION</p>
        <h1 className="mt-1 text-xl font-bold text-white font-display">Create operator account</h1>
        <div className="mt-4"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></div>
      </div>
    </main>
  );
}
