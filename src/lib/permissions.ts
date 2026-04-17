import { Role } from "@prisma/client";

// Role hierarchy: OWNER > ADMIN > MEMBER > CLIENT_VIEWER
const ROLE_WEIGHTS: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  CLIENT_VIEWER: 1,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_WEIGHTS[userRole] >= ROLE_WEIGHTS[requiredRole];
}

export function canManageTeam(role: Role): boolean {
  return hasRole(role, "ADMIN");
}

export function canManageBilling(role: Role): boolean {
  return hasRole(role, "OWNER");
}

export function canRunScans(role: Role): boolean {
  return hasRole(role, "MEMBER");
}

export function canManageWebsites(role: Role): boolean {
  return hasRole(role, "MEMBER");
}

export function canAssignIssues(role: Role): boolean {
  return hasRole(role, "MEMBER");
}

export function canConfigureOrg(role: Role): boolean {
  return hasRole(role, "ADMIN");
}

export function canDeleteOrg(role: Role): boolean {
  return role === "OWNER";
}

export function canViewClientPortal(role: Role): boolean {
  return hasRole(role, "CLIENT_VIEWER");
}
