"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

export async function createOrganization(name: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthenticated" };

  if (!name || name.length < 2 || name.length > 64) {
    return { error: "Organization name must be between 2 and 64 characters." };
  }

  const baseSlug = slugify(name) || "org";
  let slug = baseSlug;
  let suffix = 0;

  while (true) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (!existing) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const org = await db.organization.create({
    data: {
      name,
      slug,
      plan: "STARTER",
      subscriptionStatus: "TRIALING",
      trialEndsAt,
    },
  });

  await db.membership.create({
    data: {
      userId: session.user.id,
      organizationId: org.id,
      role: "OWNER",
    },
  });

  return { success: true };
}
