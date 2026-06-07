import { LinkButton } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="mt-2 text-slate-600">Your role does not have permission to view this area.</p>
      <div className="mt-6">
        <LinkButton href="/">Back to dashboard</LinkButton>
      </div>
    </main>
  );
}
