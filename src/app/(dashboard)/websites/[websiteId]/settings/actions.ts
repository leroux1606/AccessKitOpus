"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Standard, ScanFrequency } from "@prisma/client";
import { getPlanLimits } from "@/lib/plans";
import { calculateNextRunAt } from "@/lib/scan-schedule";
import { getActiveMembership } from "@/lib/get-active-org";
import { revalidatePath } from "next/cache";

interface UpdateWebsiteSettingsInput {
  websiteId: string;
  name: string;
  frequency: ScanFrequency;
  standards: string[];
  scheduledHour?: number;
  scheduledDay?: number | null;
}

export async function updateWebsiteSettings(
  input: UpdateWebsiteSettingsInput
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const membership = await getActiveMembership(session.user.id);

  if (!membership) return { error: "Not authorized" };
  if (!["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
    return { error: "Not authorized" };
  }

  const website = await db.website.findUnique({
    where: { id: input.websiteId, organizationId: membership.organizationId },
  });

  if (!website) return { error: "Website not found" };

  // Check frequency is allowed by plan
  const limits = getPlanLimits(membership.organization.plan);
  if (!limits.scanFrequencies.includes(input.frequency)) {
    return { error: `${input.frequency} scan frequency requires a higher plan.` };
  }

  // Validate standards
  const validStandards = input.standards.filter((s): s is Standard =>
    Object.values(Standard).includes(s as Standard)
  );

  if (validStandards.length === 0) {
    return { error: "Select at least one standard." };
  }

  const hour = input.scheduledHour ?? 9;
  const day = input.scheduledDay ?? null;

  await db.website.update({
    where: { id: input.websiteId },
    data: {
      name: input.name.trim() || website.name,
      scanFrequency: input.frequency,
      standards: validStandards,
    },
  });

  if (input.frequency === "MANUAL") {
    await db.scanSchedule.deleteMany({ where: { websiteId: input.websiteId } });
  } else {
    const nextRunAt = calculateNextRunAt({
      frequency: input.frequency,
      scheduledHour: hour,
      scheduledDay: day,
    });
    await db.scanSchedule.upsert({
      where: { websiteId: input.websiteId },
      create: {
        websiteId: input.websiteId,
        frequency: input.frequency,
        scheduledHour: hour,
        scheduledDay: day,
        nextRunAt,
        enabled: true,
      },
      update: {
        frequency: input.frequency,
        scheduledHour: hour,
        scheduledDay: day,
        nextRunAt,
        enabled: true,
      },
    });
  }

  revalidatePath(`/websites/${input.websiteId}`);
  revalidatePath(`/websites/${input.websiteId}/settings`);

  return {};
}

export async function deleteWebsite(websiteId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated" };

  const membership = await getActiveMembership(session.user.id);

  // Only OWNER and ADMIN may perform destructive deletes
  if (!membership) return { error: "Not authorized" };
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return { error: "Only owners and admins can delete websites" };
  }
  // Only OWNER and ADMIN may delete websites; MEMBER can only update settings
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return { error: "Not authorized" };
  }

  const website = await db.website.findUnique({
    where: { id: websiteId, organizationId: membership.organizationId },
  });

  if (!website) return { error: "Website not found" };

  // Cascade delete is handled by Prisma schema (onDelete: Cascade)
  await db.website.delete({ where: { id: websiteId } });

  revalidatePath("/websites");
  revalidatePath("/dashboard");

  return {};
}
