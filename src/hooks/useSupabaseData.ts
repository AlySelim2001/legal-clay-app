import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  CaseRow,
  CaseWithClient,
  ClientRow,
  DefenseCatalogRow,
  LegalDeadlineRow,
  ProceduralStageRow,
  AttachmentRow,
  ScheduleRow,
  CaseInsert,
  ClientInsert,
  ScheduleInsert,
} from '@/types/database';

// Extended schedule row with joined data
type ScheduleWithCase = ScheduleRow & {
  case: {
    case_code: string;
    court_name: string;
    client: { full_name: string } | null;
  } | null;
};

// Extended attachment row with joined case
type AttachmentWithCase = AttachmentRow & {
  case: { case_code: string } | null;
};

// ============================================================
// Cases
// ============================================================
export function useCases() {
  const [data, setData] = useState<CaseWithClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('cases')
      .select('*, client:clients(*)')
      .order('updated_at', { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as CaseWithClient[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

export function useCase(caseCode: string) {
  const [data, setData] = useState<CaseWithClient & {
    defense: DefenseCatalogRow | null;
    procedural_stage: ProceduralStageRow | null;
    schedules: ScheduleRow[];
    attachments: AttachmentRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('cases')
      .select(`
        *,
        client:clients(*),
        defense:defenses_catalog(*),
        procedural_stage:procedural_stages(*),
        schedules:schedule(*),
        attachments:attachments(*)
      `)
      .eq('case_code', caseCode)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(row as CaseWithClient & {
          defense: DefenseCatalogRow | null;
          procedural_stage: ProceduralStageRow | null;
          schedules: ScheduleRow[];
          attachments: AttachmentRow[];
        });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [caseCode]);

  return { data, error, loading };
}

export function useCreateCase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CaseInsert) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('cases')
      .insert(input)
      .select()
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return null;
    }
    return data as CaseRow;
  }, []);

  return { create, loading, error };
}

// ============================================================
// Clients
// ============================================================
export function useClients() {
  const [data, setData] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as ClientRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

export function useClient(clientCode: string) {
  const [data, setData] = useState<(ClientRow & { cases: CaseRow[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('clients')
      .select('*, cases:cases(*)')
      .eq('client_code', clientCode)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(row as ClientRow & { cases: CaseRow[] });
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientCode]);

  return { data, error, loading };
}

export function useCreateClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: ClientInsert) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('clients')
      .insert(input)
      .select()
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return null;
    }
    return data as ClientRow;
  }, []);

  return { create, loading, error };
}

// ============================================================
// Defenses Catalog
// ============================================================
export function useDefenses() {
  const [data, setData] = useState<DefenseCatalogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('defenses_catalog')
      .select('*')
      .order('code', { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as DefenseCatalogRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

// ============================================================
// Legal Deadlines Reference
// ============================================================
export function useLegalDeadlines() {
  const [data, setData] = useState<LegalDeadlineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('legal_deadlines_reference')
      .select('*')
      .order('code', { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as LegalDeadlineRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

// ============================================================
// Procedural Stages
// ============================================================
export function useProceduralStage(caseId: string) {
  const [data, setData] = useState<ProceduralStageRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('procedural_stages')
      .select('*')
      .eq('case_id', caseId)
      .single()
      .then(({ data: row, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(row as ProceduralStageRow);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [caseId]);

  return { data, error, loading };
}

// ============================================================
// Attachments
// ============================================================
export function useAllAttachments() {
  const [data, setData] = useState<AttachmentWithCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('attachments')
      .select('*, case:cases(case_code)')
      .order('uploaded_at', { ascending: false })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as AttachmentWithCase[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

// ============================================================
// Schedule / Hearings
// ============================================================
export function useUpcomingHearings() {
  const [data, setData] = useState<ScheduleWithCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('schedule')
      .select('*, case:cases(case_code, court_name, client:clients(full_name))')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(20)
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as ScheduleWithCase[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

export function useAllSchedules() {
  const [data, setData] = useState<ScheduleWithCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('schedule')
      .select('*, case:cases(case_code, court_name, client:clients(full_name))')
      .order('session_date', { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setData(rows as ScheduleWithCase[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

export function useCreateHearing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: ScheduleInsert) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('schedule')
      .insert(input)
      .select()
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return null;
    }
    return data as ScheduleRow;
  }, []);

  return { create, loading, error };
}

// ============================================================
// Dashboard aggregates
// ============================================================
export function useDashboardStats() {
  const [data, setData] = useState<{
    totalCases: number;
    totalClients: number;
    upcomingCount: number;
    urgentCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in3 = new Date();
    in3.setDate(in3.getDate() + 3);
    const in7Str = in7.toISOString().split('T')[0];
    const in3Str = in3.toISOString().split('T')[0];

    Promise.all([
      supabase.from('cases').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('schedule').select('id').gte('session_date', today).lte('session_date', in7Str),
      supabase.from('schedule').select('id').gte('session_date', today).lte('session_date', in3Str),
    ]).then(([casesRes, clientsRes, upcomingRes, urgentRes]) => {
      if (cancelled) return;
      setData({
        totalCases: casesRes.count ?? 0,
        totalClients: clientsRes.count ?? 0,
        upcomingCount: upcomingRes.data?.length ?? 0,
        urgentCount: urgentRes.data?.length ?? 0,
      });
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { data, error, loading };
}

// Aliases for convenience
export const useAllClients = useClients;
export const useAllCases = useCases;
