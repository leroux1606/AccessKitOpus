"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Standard } from "@prisma/client";
import { assertSafeFetchUrl, SsrfError } from "@/lib/ssrf-guard";

interface AddWebsiteInput {
  organizationId: string;
  url: string;
  name: string;
  standards: string[];
}

export async function addWebsite(
  input: AddWebsiteInput
): Promise<{ websiteId?: string; error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  // Verify membership in organization
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: input.organizationId,
      },
    },
    include: { organization: true },
  });

  if (!membership) return { error: "Not authorized" };
  if (!["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
    return { error: "Not authorized" };
  }

  // Normalize URL — handle all common user input formats:
  // "example.com", "www.example.com", "https://example.com", "https://https://example.com"
  let normalizedUrl = input.url.trim();
  // Strip any duplicate protocols (e.g. https://https://)
  normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)+/, (m) =>
    m.includes("https://") ? "https://" : "http://"
  );
  // Add https:// if no protocol present
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  // Validate it's a real URL with a hostname, and strip www. prefix
  try {
    const parsed = new URL(normalizedUrl);
    if (!parsed.hostname.includes(".")) {
      return { error: "Please enter a valid website address, e.g. example.com or https://example.com" };
    }
    // Normalise www.example.com → example.com so duplicates are caught
    if (parsed.hostname.startsWith("www.")) {
      parsed.hostname = parsed.hostname.slice(4);
      normalizedUrl = parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return { error: "Please enter a valid website address, e.g. example.com or https://example.com" };
  }

  // Validate URL and block private/internal addresses (SSRF protection)
  // Dev bypass: skip SSRF check in local development so any URL can be tested
  if (process.env.NODE_ENV !== "development") {
    try {
      await assertSafeFetchUrl(normalizedUrl);
    } catch (err) {
      if (err instanceof SsrfError) {
        return { error: "URLs pointing to private or internal addresses are not allowed." };
      }
      return { error: "Invalid URL. Please enter a valid website address." };
    }
  }

  // Remove trailing slash for consistency
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

  // Check for duplicate URL in same org
  const existingWebsite = await db.website.findFirst({
    where: {
      organizationId: input.organizationId,
      url: normalizedUrl,
    },
  });

  if (existingWebsite) {
    return { error: "This website has already been added to your organization." };
  }

  // Validate standards
  const validStandards = input.standards.filter((s): s is Standard =>
    Object.values(Standard).includes(s as Standard)
  );

  if (validStandards.length === 0) {
    return { error: "Please select at least one accessibility standard." };
  }

  // Create website
  const website = await db.website.create({
    data: {
      organizationId: input.organizationId,
      url: normalizedUrl,
      name: input.name.trim() || new URL(normalizedUrl).hostname,
      standards: validStandards,
      verified: false,
      scanFrequency: "MANUAL",
    },
  });

  return { websiteId: website.id };
}
