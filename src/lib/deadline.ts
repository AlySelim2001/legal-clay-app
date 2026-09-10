import { supabase } from '@/lib/supabase';

/**
 * Calls the PL/pgSQL compute_deadline function to calculate a deadline
 * based on the legal_deadlines_reference table.
 *
 * @param startDate - The start date (e.g., filing date, ruling date)
 * @param deadlineCode - The code from legal_deadlines_reference (e.g., 'DL-01')
 * @returns The computed deadline date, or null if open-ended
 */
export async function computeDeadline(
  startDate: string,
  deadlineCode: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('compute_deadline', {
    start_date: startDate,
    deadline_code: deadlineCode,
  });

  if (error) {
    console.error('[CRIM-SYS] compute_deadline RPC error:', error.message);
    return null;
  }
  return data as string | null;
}

/**
 * Calls the PL/pgSQL classify_urgency function to determine urgency level.
 *
 * @param targetDate - The date to classify
 * @returns 'critical' | 'high' | 'normal'
 */
export async function classifyUrgency(
  targetDate: string,
): Promise<'critical' | 'high' | 'normal'> {
  const { data, error } = await supabase.rpc('classify_urgency', {
    target_date: targetDate,
  });

  if (error) {
    console.error('[CRIM-SYS] classify_urgency RPC error:', error.message);
    return 'normal';
  }
  return (data as 'critical' | 'high' | 'normal') ?? 'normal';
}

/**
 * Today's calendar date in Africa/Cairo as an UTC-noon anchor.
 *
 * P1: urgency classification must agree with the database, which pins
 * "today" to `(now() AT TIME ZONE 'Africa/Cairo')::date` (migration 009).
 * The old fallback used `new Date()` in the DEVICE timezone, so a lawyer
 * abroad (or any UTC device before 02:00 Cairo time) saw a different
 * urgency than every other device for the same deadline.
 *
 * Anchoring both dates at 12:00 UTC makes the day-difference immune to
 * DST shifts (fixed 24h apart by construction).
 */
function cairoTodayAnchor(): Date {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "2026-09-10"
  return new Date(`${isoDate}T12:00:00Z`);
}

/**
 * Client-side fallback for urgency classification (no DB round-trip).
 * Use this when you already have the date and just need the urgency label.
 *
 * Mirrors classify_urgency(date) in the database exactly: thresholds are
 * measured against today in Africa/Cairo — never the device timezone.
 */
export function classifyUrgencyLocal(targetDate: string): 'critical' | 'high' | 'normal' {
  const target = new Date(`${targetDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return 'normal';
  const diffDays = Math.round(
    (target.getTime() - cairoTodayAnchor().getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 3) return 'critical';
  if (diffDays <= 7) return 'high';
  return 'normal';
}
