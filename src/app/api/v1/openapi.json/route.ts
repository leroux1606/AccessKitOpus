import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "AccessKit API",
    version: "1.0.0",
    description:
      "REST API for AccessKit — web accessibility monitoring. Requires Agency plan or higher. Authenticate with a Bearer API key.",
    contact: { name: "AccessKit Support" },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1 base path",
    },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key (ak_live_...) from Settings → API Keys",
      },
    },
    schemas: {
      Website: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: { type: "string", format: "uri" },
          verified: { type: "boolean" },
          currentScore: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
          lastScanAt: { type: "string", format: "date-time", nullable: true },
          scanFrequency: { type: "string", enum: ["MANUAL", "MONTHLY", "WEEKLY", "DAILY"] },
          standards: { type: "array", items: { type: "string" } },
          isCompetitor: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Scan: {
        type: "object",
        properties: {
          id: { type: "string" },
          websiteId: { type: "string" },
          status: { type: "string", enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] },
          score: { type: "integer", nullable: true },
          pagesScanned: { type: "integer" },
          totalViolations: { type: "integer", nullable: true },
          criticalCount: { type: "integer", nullable: true },
          seriousCount: { type: "integer", nullable: true },
          moderateCount: { type: "integer", nullable: true },
          minorCount: { type: "integer", nullable: true },
          duration: { type: "integer", nullable: true, description: "Milliseconds" },
          triggeredBy: { type: "string", enum: ["MANUAL", "SCHEDULED", "CI_CD", "API"] },
          startedAt: { type: "string", format: "date-time", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Issue: {
        type: "object",
        properties: {
          id: { type: "string" },
          scanId: { type: "string" },
          websiteId: { type: "string" },
          ruleId: { type: "string" },
          severity: { type: "string", enum: ["CRITICAL", "SERIOUS", "MODERATE", "MINOR"] },
          category: { type: "string" },
          description: { type: "string" },
          helpText: { type: "string" },
          htmlElement: { type: "string" },
          cssSelector: { type: "string" },
          fixSuggestion: { type: "string", nullable: true },
          aiFixSuggestion: { type: "string", nullable: true },
          fixedHtml: { type: "string", nullable: true },
          effortEstimate: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], nullable: true },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "FIXED", "VERIFIED", "WONT_FIX", "FALSE_POSITIVE"] },
          assignedToId: { type: "string", nullable: true },
          wcagCriterion: { type: "string", nullable: true },
          wcagLevel: { type: "string", nullable: true },
          standards: { type: "array", items: { type: "string" } },
          fingerprint: { type: "string" },
          firstDetectedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/websites": {
      get: {
        summary: "List websites",
        operationId: "listWebsites",
        tags: ["Websites"],
        responses: {
          "200": {
            description: "List of websites",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { type: "array", items: { $ref: "#/components/schemas/Website" } } },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Plan does not include API access" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/websites/{websiteId}": {
      get: {
        summary: "Get a website",
        operationId: "getWebsite",
        tags: ["Websites"],
        parameters: [{ name: "websiteId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Website details", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Website" } } } } } },
          "404": { description: "Website not found" },
        },
      },
    },
    "/scans": {
      get: {
        summary: "List scans",
        operationId: "listScans",
        tags: ["Scans"],
        parameters: [
          { name: "websiteId", in: "query", schema: { type: "string" }, description: "Filter by website" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Paginated list of scans",
            content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/PaginatedResponse" }, { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Scan" } } } }] } } },
          },
        },
      },
      post: {
        summary: "Trigger a scan",
        operationId: "triggerScan",
        tags: ["Scans"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["websiteId"],
                properties: { websiteId: { type: "string", description: "ID of a verified website" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Scan queued", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Scan" } } } } } },
          "400": { description: "Missing websiteId" },
          "404": { description: "Website not found or not verified" },
          "409": { description: "Scan already in progress" },
        },
      },
    },
    "/issues": {
      get: {
        summary: "List issues",
        operationId: "listIssues",
        tags: ["Issues"],
        parameters: [
          { name: "websiteId", in: "query", schema: { type: "string" } },
          { name: "scanId", in: "query", schema: { type: "string" } },
          { name: "severity", in: "query", schema: { type: "string", enum: ["CRITICAL", "SERIOUS", "MODERATE", "MINOR"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "IN_PROGRESS", "FIXED", "VERIFIED", "WONT_FIX", "FALSE_POSITIVE"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Paginated list of issues",
            content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/PaginatedResponse" }, { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Issue" } } } }] } } },
          },
        },
      },
    },
  },
};

export function GET() {
  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
