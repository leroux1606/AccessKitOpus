import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { slugify } from "@/lib/utils";

/** Create a new client portal */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["AGENCY", "ENTERPRISE"].includes(membership.organization.plan)) {
    return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
  }

  const body = await req.json();
  const { websiteId, companyName, password } = body as {
    websiteId: string;
    companyName?: string;
    password?: string;
  };

  if (!websiteId) {
    return NextResponse.json({ error: "Website ID required" }, { status: 400 });
  }

  // Verify the website belongs to this org
  const website = await db.website.findFirst({
    where: { id: websiteId, organizationId: membership.organizationId },
  });

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  // Check if portal already exists for this website
  const existing = await db.clientPortal.findFirst({
    where: { websiteId, organizationId: membership.organizationId },
  });

  if (existing) {
    return NextResponse.json({ error: "Portal already exists for this website" }, { status: 409 });
  }

  // Generate unique slug
  const baseName = companyName || website.name;
  let slug = slugify(baseName);
  let suffix = 0;
  while (await db.clientPortal.findUnique({ where: { slug } })) {
    suffix++;
    slug = `${slugify(baseName)}-${suffix}`;
  }

  // Hash password if provided
  let passwordHash: string | null = null;
  if (password) {
    const { createHash } = await import("crypto");
    passwordHash = createHash("sha256").update(password).digest("hex");
  }

  const portal = await db.clientPortal.create({
    data: {
      organizationId: membership.organizationId,
      websiteId,
      slug,
      companyName: companyName || website.name,
      passwordHash,
      enabled: true,
    },
    include: { website: { select: { name: true, url: true } } },
  });

  return NextResponse.json(portal);
}

/** List client portals for this org */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const portals = await db.clientPortal.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      website: { select: { name: true, url: true, currentScore: true, lastScanAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(portals);
}
