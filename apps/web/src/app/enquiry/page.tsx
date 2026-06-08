import { submitPublicEnquiry } from "@/lib/public-enquiry";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function EnquiryPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-sm font-medium text-rose-700">Sreedhareeyam Ayurveda Hospital</p>
      <h1 className="mb-1 text-2xl font-bold">Request a callback</h1>
      <p className="mb-6 text-sm text-slate-600">Leave your details and our team will reach out to help you book a consultation.</p>

      {submitted ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Thank you — your enquiry has been received. Our team will call you shortly.
        </div>
      ) : (
        <form action={submitPublicEnquiry} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Name *<input name="name" required className={input} /></label>
          <label className="block text-sm font-medium text-slate-700">Phone *<input name="phone" required className={input} /></label>
          <label className="block text-sm font-medium text-slate-700">Email<input name="email" type="email" className={input} /></label>
          <label className="block text-sm font-medium text-slate-700">How can we help?<textarea name="message" rows={3} className={input} /></label>
          <button type="submit" className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Submit enquiry</button>
        </form>
      )}
    </main>
  );
}
