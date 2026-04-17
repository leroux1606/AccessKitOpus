import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";

/** Create a new API key */
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
  const { name } = body as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Limit to 10 keys per org
  const count = await db.apiKey.count({
    where: { organizationId: membership.organizationId },
  });
  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 API keys per organization" }, { status: 400 });
  }

  // Generate a secure random key: ak_live_<32 random hex chars>
  const rawKey = `ak_live_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.create({
    data: {
      organizationId: membership.organizationId,
      name: name.trim(),
      keyHash,
    },
  });

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    key: rawKey,
    createdAt: apiKey.createdAt,
  });
}

/** Delete (revoke) an API key */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  // Verify the key belongs to this org
  const key = await db.apiKey.findFirst({
    where: { id: keyId, organizationId: membership.organizationId },
  });

  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id: keyId } });

  return NextResponse.json({ success: true });
}
