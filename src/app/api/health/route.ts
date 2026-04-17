import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint.
 * Returns 200 when the app and database are reachable.
 * Used by load balancers, uptime monitors, and k8s liveness probes.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
