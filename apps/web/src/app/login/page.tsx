import { loginWithPassword } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const showDemo = process.env.SHOW_DEMO_LOGINS !== "false";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-20">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-700 to-gold-500 text-lg font-bold text-white">S</span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Sreedhareeyam Ayurveda Hospital</p>
          <p className="text-xs text-slate-400">Patient Relationship Management</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="h-1 bg-gradient-to-r from-rose-700 to-gold-500" />
        <div className="p-6">
          <h1 className="mb-5 text-xl font-bold text-slate-900 dark:text-slate-50">Sign in</h1>

          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">Invalid email or password.</div>}

          <form action={loginWithPassword} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email
              <input name="email" type="email" required autoComplete="username" className={input} />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password
              <input name="password" type="password" required autoComplete="current-password" className={input} />
            </label>
            <button type="submit" className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Sign in</button>
          </form>
        </div>
      </div>

      {showDemo && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">Demo accounts (password: <code>Sreedhareeyam@1</code>)</p>
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
