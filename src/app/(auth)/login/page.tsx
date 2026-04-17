import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-lg flex items-center justify-center shadow-lg shadow-[hsl(262,83%,68%)]/20">
              <span className="text-white font-bold text-sm">AK</span>
            </div>
            <span className="text-xl font-bold text-foreground">AccessKit</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in to your account to continue
        </p>
      </div>

      {params.error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-[hsl(0,72%,65%)] text-center"
        >
          {params.error === "OAuthAccountNotLinked"
            ? "This email is already registered with a different sign-in method."
            : "An error occurred. Please try again."}
        </div>
      )}

      <SignInForm callbackUrl={params.callbackUrl ?? "/dashboard"} />

      <p className="text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        <a href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
