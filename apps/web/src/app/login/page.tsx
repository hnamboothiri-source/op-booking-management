import { prisma } from "@/lib/db";
import { loginAs } from "@/lib/auth-actions";
import { Card, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">Sreedhareeyam PRM</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        Dev login — choose a staff identity to explore role-based access. (Real auth arrives later.)
      </p>
      <div className="space-y-3">
        {staff.length === 0 && (
          <Card>
            <p className="text-sm text-slate-600">
              No staff users found. Run <code>npm run db:seed</code> first.
            </p>
          </Card>
        )}
        {staff.map((u) => (
          <Card key={u.id}>
            <form action={loginAs.bind(null, u.id)} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-slate-500">{u.role.replace(/_/g, " ")} · {u.email}</div>
              </div>
              <SubmitButton>Sign in</SubmitButton>
            </form>
          </Card>
        ))}
      </div>
    </main>
  );
}
