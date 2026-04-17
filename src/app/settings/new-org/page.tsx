import { redirect } from "next/navigation";

// The org switcher links here — redirect to onboarding which has the create-org form.
export default function NewOrgRedirectPage() {
  redirect("/onboarding");
}
