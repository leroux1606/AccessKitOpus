import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifyRequestPage() {
  return (
    <div className="rounded-lg border bg-card p-8 text-center space-y-4">
      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Mail className="h-7 w-7 text-primary" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold">Check your email</h1>
      <p className="text-sm text-muted-foreground">
        A sign-in link has been sent to your email address. Click the link to
        complete sign-in.
      </p>
      <p className="text-xs text-muted-foreground">
        If you don&apos;t see it, check your spam folder.
      </p>
      <Button variant="outline" asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
