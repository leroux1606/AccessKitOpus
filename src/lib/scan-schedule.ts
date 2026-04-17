/**
 * Shared schedule-calculation logic. Single source of truth for:
 *   - the initial `nextRunAt` when a user saves a website's scan settings
 *     (`src/app/(dashboard)/websites/[websiteId]/settings/actions.ts`)
 *   - the rolling `nextRunAt` advanced by the Inngest cron
 *     (`src/inngest/scheduled-scans.ts`)
 *
 * Both call sites must use this helper so schedules don't drift.
 */

import type { ScanFrequency } from "@prisma/client";

export interface CalculateNextRunOptions {
  frequency: ScanFrequency;
  scheduledHour: number;
  scheduledDay: number | null;
  /** Inject the "now" reference (useful for testing). Defaults to new Date(). */
  now?: Date;
  /**
   * When true, always advance at least one period from the scheduled slot.
   * Used after a run completes so the next run is always in the future.
   * When false, returns the earliest slot >= now (used on schedule creation).
   */
  forceAdvance?: boolean;
}

export function calculateNextRunAt(opts: CalculateNextRunOptions): Date {
  const { frequency, scheduledHour, scheduledDay, forceAdvance = false } = opts;
  const now = opts.now ?? new Date();

  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(scheduledHour);

  if (frequency === "DAILY") {
    if (forceAdvance || next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === "WEEKLY") {
    const target = scheduledDay ?? 1; // default Monday
    let diff = (target - next.getUTCDay() + 7) % 7;
    if (diff === 0 && (forceAdvance || next <= now)) diff = 7;
    next.setUTCDate(next.getUTCDate() + diff);
  } else if (frequency === "MONTHLY") {
    const target = scheduledDay ?? 1; // default 1st of month
    next.setUTCDate(target);
    if (forceAdvance || next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
  }

  return next;
}
