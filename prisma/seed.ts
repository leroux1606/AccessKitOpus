import { PrismaClient, PlanType, Role, ScanStatus, TriggerType, Severity, Category, Engine, IssueStatus, EffortLevel } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing seed data
  await db.violation.deleteMany({});
  await db.page.deleteMany({});
  await db.scan.deleteMany({});
  await db.website.deleteMany({});
  await db.membership.deleteMany({});
  await db.organization.deleteMany({});
  await db.account.deleteMany({});
  await db.session.deleteMany({});
  await db.user.deleteMany({});

  // Create test user
  const user = await db.user.create({
    data: {
      name: "Test User",
      email: "test@accesskit.app",
      emailVerified: new Date(),
    },
  });

  // Create agency organization
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const org = await db.organization.create({
    data: {
      name: "Demo Agency",
      slug: "demo-agency",
      plan: PlanType.AGENCY,
      subscriptionStatus: "ACTIVE",
    },
  });

  await db.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });

  // Create a second member
  const member = await db.user.create({
    data: {
      name: "Jane Developer",
      email: "jane@accesskit.app",
      emailVerified: new Date(),
    },
  });

  await db.membership.create({
    data: {
      userId: member.id,
      organizationId: org.id,
      role: Role.MEMBER,
    },
  });

  // Create websites
  const acmeWebsite = await db.website.create({
    data: {
      organizationId: org.id,
      url: "https://acme-corp.example.com",
      name: "Acme Corp",
      verified: true,
      verificationMethod: "META_TAG",
      currentScore: 72,
      lastScanAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      scanFrequency: "WEEKLY",
      standards: ["WCAG21_AA", "SECTION_508"],
    },
  });

  const techWebsite = await db.website.create({
    data: {
      organizationId: org.id,
      url: "https://techstart.example.com",
      name: "TechStart",
      verified: true,
      currentScore: 91,
      lastScanAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      scanFrequency: "DAILY",
      standards: ["WCAG21_AA", "WCAG22_AA"],
    },
  });

  const shopWebsite = await db.website.create({
    data: {
      organizationId: org.id,
      url: "https://shopify-store.example.com",
      name: "Fashion Store",
      verified: false,
      scanFrequency: "MANUAL",
      standards: ["WCAG21_AA"],
    },
  });

  // Create a completed scan for Acme Corp
  const scan = await db.scan.create({
    data: {
      websiteId: acmeWebsite.id,
      status: ScanStatus.COMPLETED,
      score: 72,
      pagesScanned: 18,
      pageLimit: 1000,
      totalViolations: 34,
      criticalCount: 3,
      seriousCount: 8,
      moderateCount: 15,
      minorCount: 8,
      duration: 45000,
      triggeredBy: TriggerType.SCHEDULED,
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000 - 45000),
      completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  });

  // Create a page for the scan
  const homePage = await db.page.create({
    data: {
      scanId: scan.id,
      url: "https://acme-corp.example.com",
      title: "Acme Corp - Home",
      score: 68,
      violationCount: 12,
      loadTime: 1234,
    },
  });

  // Create some violations
  const violations = [
    {
      ruleId: "image-alt",
      engine: Engine.AXE_CORE,
      severity: Severity.CRITICAL,
      category: Category.IMAGES,
      description: "Images must have alternate text",
      helpText: "Ensures <img> elements have alternate text or a role of none or presentation",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/image-alt",
      htmlElement: '<img src="/logo.png">',
      cssSelector: "header > img",
      standards: ["WCAG21_AA_1.1.1", "SECTION_508_a"],
      wcagCriterion: "1.1.1",
      wcagLevel: "A",
      fixSuggestion: 'Add an alt attribute: <img src="/logo.png" alt="Acme Corp logo">',
      effortEstimate: EffortLevel.LOW,
    },
    {
      ruleId: "color-contrast",
      engine: Engine.AXE_CORE,
      severity: Severity.SERIOUS,
      category: Category.COLOR,
      description: "Elements must meet minimum color contrast ratio",
      helpText: "Ensures the contrast between foreground and background colors meets WCAG AA contrast ratio thresholds",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
      htmlElement: '<p class="subtitle" style="color: #aaa">Learn more about our services</p>',
      cssSelector: ".hero .subtitle",
      standards: ["WCAG21_AA_1.4.3"],
      wcagCriterion: "1.4.3",
      wcagLevel: "AA",
      fixSuggestion: "Change text color from #aaa to #767676 or darker to achieve 4.5:1 contrast ratio.",
      effortEstimate: EffortLevel.LOW,
    },
    {
      ruleId: "label",
      engine: Engine.AXE_CORE,
      severity: Severity.CRITICAL,
      category: Category.FORMS,
      description: "Form elements must have labels",
      helpText: "Ensures every form element has a label",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.7/label",
      htmlElement: '<input type="email" placeholder="Enter email">',
      cssSelector: "form.newsletter input[type=email]",
      standards: ["WCAG21_AA_1.3.1", "WCAG21_AA_4.1.2"],
      wcagCriterion: "1.3.1",
      wcagLevel: "A",
      fixSuggestion: '<label for="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="Enter email">',
      effortEstimate: EffortLevel.LOW,
    },
  ];

  for (const v of violations) {
    const fingerprint = createHash("sha256")
      .update(`${v.ruleId}:${v.cssSelector}:${acmeWebsite.url}`)
      .digest("hex");

    await db.violation.create({
      data: {
        scanId: scan.id,
        pageId: homePage.id,
        websiteId: acmeWebsite.id,
        fingerprint,
        firstDetectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: IssueStatus.OPEN,
        impact: v.severity.toLowerCase(),
        ...v,
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   User: test@accesskit.app`);
  console.log(`   Organization: Demo Agency`);
  console.log(`   Websites: ${[acmeWebsite.name, techWebsite.name, shopWebsite.name].join(", ")}`);
  console.log(`   Violations seeded: ${violations.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
