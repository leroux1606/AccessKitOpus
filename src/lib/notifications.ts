import { db } from "@/lib/db";
import { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  /** If provided, only notify these user IDs. Otherwise notify all org members. */
  userIds?: string[];
}

/**
 * Create in-app notifications for org members, respecting their preferences.
 * Returns the count of notifications created.
 */
export async function createNotifications(input: CreateNotificationInput): Promise<number> {
  const { organizationId, type, title, message, link, userIds } = input;

  // Get target members
  const whereClause: Record<string, unknown> = { organizationId };
  if (userIds?.length) {
    whereClause.userId = { in: userIds };
  }

  const members = await db.membership.findMany({
    where: whereClause,
    select: { userId: true },
  });

  if (members.length === 0) return 0;

  const memberUserIds = members.map((m) => m.userId);

  // Fetch notification preferences for these users
  const prefs = await db.notificationPreference.findMany({
    where: {
      organizationId,
      type,
      userId: { in: memberUserIds },
    },
  });
  const prefMap = new Map(prefs.map((p) => [p.userId, p]));

  // Create in-app notifications for users who haven't disabled them
  const notificationsToCreate = memberUserIds
    .filter((uid) => {
      const pref = prefMap.get(uid);
      return pref ? pref.inApp : true; // default: enabled
    })
    .map((userId) => ({
      userId,
      organizationId,
      type,
      title,
      message,
      link: link ?? null,
    }));

  if (notificationsToCreate.length > 0) {
    await db.notification.createMany({ data: notificationsToCreate });
  }

  return notificationsToCreate.length;
}

/**
 * Get email recipients for a notification type within an org,
 * respecting their notification preferences.
 */
export async function getEmailRecipients(
  organizationId: string,
  type: NotificationType,
  userIds?: string[],
): Promise<Array<{ userId: string; email: string; name: string | null }>> {
  const whereClause: Record<string, unknown> = { organizationId };
  if (userIds?.length) {
    whereClause.userId = { in: userIds };
  }

  const members = await db.membership.findMany({
    where: whereClause,
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const memberUserIds = members.map((m) => m.userId);

  const prefs = await db.notificationPreference.findMany({
    where: {
      organizationId,
      type,
      userId: { in: memberUserIds },
    },
  });
  const prefMap = new Map(prefs.map((p) => [p.userId, p]));

  return members
    .filter((m) => {
      const pref = prefMap.get(m.userId);
      return pref ? pref.email : true; // default: enabled
    })
    .map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    }));
}
