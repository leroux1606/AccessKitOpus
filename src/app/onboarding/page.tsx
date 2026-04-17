"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { createOrganization } from "./actions";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createOrganization(name.trim());
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-[hsl(262,83%,68%)] opacity-[0.06] blur-[120px]" />
      </div>

      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] rounded-lg flex items-center justify-center shadow-lg shadow-[hsl(262,83%,68%)]/20">
                <span className="text-white font-bold text-sm" aria-hidden="true">AK</span>
              </div>
              <span className="font-bold text-lg text-foreground">AccessKit</span>
            </div>
          </div>

          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>

          <CardTitle className="text-xl">Create your organization</CardTitle>
          <CardDescription>
            Give your organization a name to get started. You can change this later.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium mb-1.5">
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Agency"
                required
                minLength={2}
                maxLength={64}
                disabled={isPending}
                className={cn(
                  "w-full rounded-lg border border-border/50 bg-secondary/50 px-3 py-2.5 text-sm text-foreground",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-border"
                )}
                autoFocus
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[hsl(262,83%,68%)] to-[hsl(280,80%,55%)] hover:from-[hsl(262,83%,60%)] hover:to-[hsl(280,80%,48%)] text-white border-0 shadow-lg shadow-[hsl(262,83%,68%)]/20 h-11"
              disabled={isPending || name.trim().length < 2}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Create organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
