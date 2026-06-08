import { redirect } from "next/navigation";

// The Lead Management hub is now the generic module dashboard.
export default function LeadOverviewRedirect() {
  redirect("/modules/leads");
}
