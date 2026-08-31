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
 * Client-side fallback for urgency classification (no DB round-trip).
 * Use this when you already have the date and just need the urgency label.
 */
export function classifyUrgencyLocal(targetDate: string): 'critical' | 'high' | 'normal' {
  const now = new Date();
  const target = new Date(targetDate);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return 'critical';
  if (diffDays <= 7) return 'high';
  return 'normal';
}
