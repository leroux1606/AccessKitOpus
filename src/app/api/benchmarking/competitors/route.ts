import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveMembership } from "@/lib/get-active-org";
import { getPlanLimits } from "@/lib/plans";

// POST /api/benchmarking/competitors — add a competitor website
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const org = membership.organization;
  const limits = getPlanLimits(org.plan);

  if (!limits.hasBenchmarking) {
    return NextResponse.json({ error: "Benchmarking not available on your plan" }, { status: 403 });
  }

  const currentCount = await db.website.count({
    where: { organizationId: org.id, isCompetitor: true },
  });

  if (currentCount >= limits.competitorScans) {
    return NextResponse.json(
      { error: `Competitor limit reached (${limits.competitorScans})` },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { name, url } = body;

  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
  }

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const competitor = await db.website.create({
    data: {
      organizationId: org.id,
      name: name.trim(),
      url: normalizedUrl,
      isCompetitor: true,
      verified: true, // Competitors don't need verification
    },
  });

  return NextResponse.json({ competitor }, { status: 201 });
}

// DELETE /api/benchmarking/competitors?id=xxx — remove a competitor
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Ensure the website belongs to this org and is a competitor
  await db.website.deleteMany({
    where: {
      id,
      organizationId: membership.organizationId,
      isCompetitor: true,
    },
  });

  return NextResponse.json({ success: true });
}
