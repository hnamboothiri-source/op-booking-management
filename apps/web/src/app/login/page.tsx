import { loginWithPassword } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const showDemo = process.env.SHOW_DEMO_LOGINS !== "false";

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <p className="text-sm font-medium text-rose-700">Sreedhareeyam Ayurveda Hospital</p>
      <h1 className="mb-6 text-2xl font-bold">PRM sign in</h1>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Invalid email or password.</div>}

      <form action={loginWithPassword} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Email
          <input name="email" type="email" required autoComplete="username" className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Password
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        <button type="submit" className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Sign in</button>
      </form>

      {showDemo && (
        <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="mb-1 font-medium text-slate-600">Demo accounts (password: <code>Sreedhareeyam@1</code>)</p>
          <ul className="space-y-0.5">
            <li>admin@sreedhareeyam.test — administrator</li>
            <li>callexec@sreedhareeyam.test — call centre</li>
            <li>menon@sreedhareeyam.test — doctor</li>
            <li>front@sreedhareeyam.test — front office</li>
          </ul>
        </div>
      )}
    </main>
  );
}
