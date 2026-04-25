import { PlanType } from "@prisma/client";

/**
 * Sentinel value for "effectively unlimited" plan limits. Using a large finite
 * number instead of `Infinity` so values JSON-serialize correctly (Infinity →
 * null) and can be safely compared/stored.
 */
export const UNLIMITED = 999_999;

/** Returns true when a plan limit should be treated as uncapped. */
export function isUnlimited(value: number): boolean {
  return value >= UNLIMITED;
}

export interface PlanLimits {
  websites: number;
  pagesPerScan: number;
  teamSeats: number;
  scanFrequencies: string[];
  hasWhiteLabel: boolean;
  hasClientPortal: boolean;
  hasCiCd: boolean;
  hasApi: boolean;
  hasBenchmarking: boolean;
  hasCompliancePackage: boolean;
  hasAiFixes: boolean;
  competitorScans: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  STARTER: {
    websites: 3,
    pagesPerScan: 50,
    teamSeats: 2,
    scanFrequencies: ["MANUAL", "MONTHLY"],
    hasWhiteLabel: false,
    hasClientPortal: false,
    hasCiCd: false,
    hasApi: false,
    hasBenchmarking: false,
    hasCompliancePackage: false,
    hasAiFixes: false,
    competitorScans: 0,
  },
  PROFESSIONAL: {
    websites: 25,
    pagesPerScan: 250,
    teamSeats: 3,
    scanFrequencies: ["MANUAL", "MONTHLY", "WEEKLY"],
    hasWhiteLabel: false,
    hasClientPortal: false,
    hasCiCd: true,
    hasApi: false,
    hasBenchmarking: false,
    hasCompliancePackage: false,
    hasAiFixes: false,
    competitorScans: 0,
  },
  AGENCY: {
    websites: 150,
    pagesPerScan: 1000,
    teamSeats: 10,
    scanFrequencies: ["MANUAL", "MONTHLY", "WEEKLY", "DAILY"],
    hasWhiteLabel: true,
    hasClientPortal: true,
    hasCiCd: true,
    hasApi: true,
    hasBenchmarking: true,
    hasCompliancePackage: true,
    hasAiFixes: true,
    competitorScans: 5,
  },
  ENTERPRISE: {
    websites: UNLIMITED,
    pagesPerScan: UNLIMITED,
    teamSeats: UNLIMITED,
    scanFrequencies: ["MANUAL", "MONTHLY", "WEEKLY", "DAILY"],
    hasWhiteLabel: true,
    hasClientPortal: true,
    hasCiCd: true,
    hasApi: true,
    hasBenchmarking: true,
    hasCompliancePackage: true,
    hasAiFixes: true,
    competitorScans: UNLIMITED,
  },
};

export const PLAN_PRICES = {
  STARTER: { monthly: 49, annual: 39 },
  PROFESSIONAL: { monthly: 149, annual: 119 },
  AGENCY: { monthly: 349, annual: 279 },
  ENTERPRISE: { monthly: 0, annual: 0 }, // custom
};

export const PLAN_NAMES: Record<PlanType, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

export function getPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan];
}
