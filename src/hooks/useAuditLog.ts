import { supabase } from "@/integrations/supabase/client";

type AuditAction =
  | "login"
  | "logout"
  | "comparison_started"
  | "comparison_completed"
  | "glossary_term_created"
  | "glossary_term_updated"
  | "glossary_term_deleted"
  | "category_created"
  | "category_updated"
  | "category_deleted";

export const logAuditEvent = async (
  action: AuditAction,
  details?: Record<string, unknown>
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from("audit_log" as any).insert({
      user_id: session.user.id,
      user_email: session.user.email,
      action,
      details: details || null,
    } as any);
  } catch {
    // Silent fail — audit logging should never break the app
  }
};
