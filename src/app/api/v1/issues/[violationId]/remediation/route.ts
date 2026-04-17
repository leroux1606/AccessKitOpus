import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  buildRemediationPatch,
  canAutoRemediate,
  supportedRuleIds,
} from "@/lib/remediation";

/**
 * POST /api/v1/issues/{violationId}/remediation
 *
 * Given a violation the caller owns and a `filePath` + `sourceContent` pair
 * for the file that contains the offending element, return a unified diff
 * that fixes the violation — or a 422 explaining why the rule can't be
 * auto-remediated.
 *
 * This is the public-API hook that the future GitHub App / bugbot / CLI
 * wrapper will call once per violation per PR. The endpoint is intentionally
 * stateless: we don't persist the diff, we don't commit anything, we don't
 * take repo credentials. The caller is expected to apply the patch on its
 * side with `git apply` and open the PR.
 *
 * Response shapes:
 *   200 { ruleId, summary, rationale, unifiedDiff, updatedContent }
 *   404 { error: "Violation not found" }
 *   422 { error, ruleId, supportedRuleIds }  — rule not machine-fixable or no-op
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ violationId: string }> },
) {
  const authResult = await validateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { violationId } = await params;

  const violation = await db.violation.findUnique({
    where: { id: violationId },
    select: {
      id: true,
      ruleId: true,
      cssSelector: true,
      description: true,
      website: { select: { organizationId: true } },
    },
  });

  if (!violation || violation.website.organizationId !== authResult.organizationId) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  let body: { filePath?: unknown; sourceContent?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filePath = typeof body.filePath === "string" ? body.filePath : "";
  const sourceContent = typeof body.sourceContent === "string" ? body.sourceContent : "";
  if (!filePath || !sourceContent) {
    return NextResponse.json(
      { error: "Body must include { filePath: string, sourceContent: string }" },
      { status: 400 },
    );
  }

  // Enforce a sensible size cap — we don't want to accept megabytes of source
  // code from the public API. Real HTML files are rarely above 500 KB.
  const MAX_BYTES = 512 * 1024;
  if (Buffer.byteLength(sourceContent, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: `sourceContent exceeds ${MAX_BYTES} bytes` },
      { status: 413 },
    );
  }

  if (!canAutoRemediate(violation.ruleId)) {
    return NextResponse.json(
      {
        error: "This rule does not have a mechanical fix. Fall back to AI suggestion.",
        ruleId: violation.ruleId,
        supportedRuleIds: supportedRuleIds(),
      },
      { status: 422 },
    );
  }

  const patch = buildRemediationPatch(filePath, sourceContent, {
    ruleId: violation.ruleId,
    cssSelector: violation.cssSelector,
    description: violation.description,
  });

  if (!patch) {
    return NextResponse.json(
      {
        error:
          "Source content did not contain the violating pattern (or it was already fixed).",
        ruleId: violation.ruleId,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ruleId: patch.ruleId,
    summary: patch.summary,
    rationale: patch.rationale,
    unifiedDiff: patch.unifiedDiff,
    updatedContent: patch.updatedContent,
  });
}
