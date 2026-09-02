// ============================================================
// CRIM-SYS Enterprise — Client-Side Audit Logger
// Complements server-side SQL triggers with browser context metadata
// ============================================================

import { supabase } from "@/lib/supabase";
import type { AuditActionType } from "@/types/enterprise";

interface AuditEvent {
  entityType: string;
  entityId: string;
  action: AuditActionType;
  description?: string;
}

/**
 * Log an audit event from the client side.
 * This writes to the same enterprise_audit_log table as the server triggers,
 * but adds browser device metadata for forensic traceability.
 *
 * Server-side triggers handle the core CRUD audit trail;
 * this utility adds supplementary context (device, description).
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Build limited device metadata (no sensitive info)
    const deviceMeta = [
      navigator.userAgent.split(" ").slice(-1)[0] ?? "unknown",
      new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo" }).format(),
    ].join(" | ");

    const { error } = await supabase.from("enterprise_audit_log").insert({
      user_id: user?.id ?? null,
      entity_type: event.entityType,
      entity_id: event.entityId,
      action: event.action,
      new_value_hash: event.description
        ? btoa(encodeURIComponent(event.description)).slice(0, 64)
        : null,
      device_metadata_limited: deviceMeta.slice(0, 256),
    });

    if (error) {
      console.warn("[CRIM-SYS] Audit log write failed:", error.message);
    }
  } catch {
    // Silently fail — audit logging should never block user actions
  }
}

/**
 * Convenience wrappers for common audit events
 */
export const audit = {
  caseCreated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_cases", entityId: id, action: "CREATE" }),
  caseUpdated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_cases", entityId: id, action: "UPDATE" }),
  caseDeleted: (id: string) =>
    logAuditEvent({ entityType: "enterprise_cases", entityId: id, action: "DELETE" }),

  personCreated: (id: string) =>
    logAuditEvent({ entityType: "persons", entityId: id, action: "CREATE" }),
  personUpdated: (id: string) =>
    logAuditEvent({ entityType: "persons", entityId: id, action: "UPDATE" }),
  personDeleted: (id: string) =>
    logAuditEvent({ entityType: "persons", entityId: id, action: "DELETE" }),

  sessionCreated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_sessions", entityId: id, action: "CREATE" }),
  sessionUpdated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_sessions", entityId: id, action: "UPDATE" }),

  documentUploaded: (id: string, fileName: string) =>
    logAuditEvent({ entityType: "enterprise_documents", entityId: id, action: "CREATE", description: fileName }),
  documentDownloaded: (id: string) =>
    logAuditEvent({ entityType: "enterprise_documents", entityId: id, action: "VIEW", description: "download" }),

  actionCreated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_actions", entityId: id, action: "CREATE" }),
  actionUpdated: (id: string) =>
    logAuditEvent({ entityType: "enterprise_actions", entityId: id, action: "UPDATE" }),
};
