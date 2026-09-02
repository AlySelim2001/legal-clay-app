// ============================================================
// CRIM-SYS Enterprise — Role-Based Access Control
// Server-side enforcement via Supabase RLS + client-side helpers
// ============================================================

import type { UserRoleType } from "@/types/enterprise";
import { RolePermissions } from "@/types/enterprise";

// ---- Permission Check Helpers ----

export type Permission =
  | "canCreate"
  | "canEdit"
  | "canDelete"
  | "canViewAll"
  | "canManageUsers"
  | "canViewAuditLog"
  | "canExport"
  | "canImport"
  | "canManageSettings";

/**
 * Check if a given role has a specific permission.
 * NOTE: This is a client-side convenience check.
 * Actual authorization is enforced by Supabase RLS policies.
 */
export function checkPermission(role: UserRoleType, permission: Permission): boolean {
  const perms = RolePermissions[role];
  if (!perms) return false;
  return (perms as Record<string, boolean>)[permission] ?? false;
}

/**
 * Assert a permission — throws if the role lacks it.
 * Use this in action handlers before mutating data.
 */
export function assertPermission(
  role: UserRoleType,
  permission: Permission,
): void {
  if (!checkPermission(role, permission)) {
    throw new Error(
      `الصلاحية المطلوبة: ${permission} — الدور الحالي: ${role}`,
    );
  }
}

/**
 * Get the human-readable label for a user role.
 */
export function getRoleLabel(role: UserRoleType): string {
  const labels: Record<UserRoleType, string> = {
    admin: "مدير النظام",
    lawyer: "محامٍ / مشرف قانوني",
    assistant: "مساعد قانوني",
    readonly: "مستخدم للقراءة فقط",
  };
  return labels[role] ?? "غير معروف";
}

/**
 * Check if a role can perform delete operations.
 */
export function canDelete(role: UserRoleType): boolean {
  return role === "admin";
}

/**
 * Check if a role can manage users.
 */
export function canManageUsers(role: UserRoleType): boolean {
  return role === "admin";
}

/**
 * Check if a role can view audit logs.
 */
export function canViewAuditLog(role: UserRoleType): boolean {
  return role === "admin";
}

/**
 * Check if a role can export/import data.
 */
export function canExportData(role: UserRoleType): boolean {
  return role === "admin" || role === "lawyer";
}

export function canImportData(role: UserRoleType): boolean {
  return role === "admin";
}
