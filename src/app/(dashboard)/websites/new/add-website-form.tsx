"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWebsite } from "./actions";
import { cn } from "@/lib/utils";

const STANDARDS_OPTIONS = [
  { value: "WCAG21_AA", label: "WCAG 2.1 Level AA", description: "Most common standard" },
  { value: "WCAG21_A", label: "WCAG 2.1 Level A", description: "Minimum accessibility" },
  { value: "WCAG22_AA", label: "WCAG 2.2 Level AA", description: "Latest standard (2023)" },
  { value: "SECTION_508", label: "Section 508", description: "US federal requirements" },
  { value: "EN_301_549", label: "EN 301 549", description: "EU accessibility act" },
] as const;

interface AddWebsiteFormProps {
  organizationId: string;
}

export function AddWebsiteForm({ organizationId }: AddWebsiteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedStandards, setSelectedStandards] = useState<string[]>(["WCAG21_AA"]);

  function toggleStandard(value: string) {
    setSelectedStandards((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const url = formData.get("url") as string;
    const name = formData.get("name") as string;

    if (selectedStandards.length === 0) {
      setError("Please select at least one accessibility standard.");
      return;
    }

    startTransition(async () => {
      const result = await addWebsite({
        organizationId,
        url,
        name,
        standards: selectedStandards,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.websiteId) {
        router.push(`/websites/${result.websiteId}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-1.5">
          Website URL <span aria-hidden="true" className="text-destructive">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            id="url"
            name="url"
            type="text"
            required
            placeholder="example.com"
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:opacity-50"
            )}
            disabled={isPending}
            autoComplete="url"
            inputMode="url"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enter a domain — e.g. <span className="font-mono">example.com</span> or <span className="font-mono">https://example.com</span>
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1.5">
          Display name <span aria-hidden="true" className="text-destructive">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="My Website"
          className={cn(
            "w-full px-3 py-2 rounded-md border border-input bg-background text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:opacity-50"
          )}
          disabled={isPending}
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-2">
          Accessibility standards to check
        </legend>
        <p className="text-xs text-muted-foreground mb-3">
          Select which standards to test against. WCAG 2.1 AA is recommended for most websites.
        </p>
        <div className="space-y-2">
          {STANDARDS_OPTIONS.map((standard) => (
            <label
              key={standard.value}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                selectedStandards.includes(standard.value)
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-muted/50"
              )}
            >
              <input
                type="checkbox"
                checked={selectedStandards.includes(standard.value)}
                onChange={() => toggleStandard(standard.value)}
                className="h-4 w-4 rounded accent-primary"
                disabled={isPending}
              />
              <div>
                <p className="text-sm font-medium">{standard.label}</p>
                <p className="text-xs text-muted-foreground">{standard.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" className="w-full" disabled={isPending || selectedStandards.length === 0}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            Adding website...
          </>
        ) : (
          "Add website"
        )}
      </Button>
    </form>
  );
}
