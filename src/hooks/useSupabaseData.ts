import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const { data, error, isLoading } = useQuery<CaseWithClient[]>({
    queryKey: ['cases'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('cases')
        .select('*, client:clients(*)')
        .order('updated_at', { ascending: false });
      if (err) throw new Error(err.message);
      return rows as CaseWithClient[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCase(caseCode: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['cases', caseCode],
    queryFn: async () => {
      const { data: row, error: err } = await supabase
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
        .single();
      if (err) throw new Error(err.message);
      return row as CaseWithClient & {
        defense: DefenseCatalogRow | null;
        procedural_stage: ProceduralStageRow | null;
        schedules: ScheduleRow[];
        attachments: AttachmentRow[];
      };
    },
    enabled: !!caseCode,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: CaseInsert) => {
      const { data, error: err } = await supabase
        .from('cases')
        .insert(input)
        .select()
        .single();
      if (err) throw new Error(err.message);
      return data as CaseRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const create = useCallback(async (input: CaseInsert) => {
    try {
      return await mutateAsync(input);
    } catch {
      return null;
    }
  }, [mutateAsync]);

  return { create, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Clients
// ============================================================
export function useClients() {
  const { data, error, isLoading } = useQuery<ClientRow[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw new Error(err.message);
      return rows as ClientRow[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useClient(clientCode: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['clients', clientCode],
    queryFn: async () => {
      const { data: row, error: err } = await supabase
        .from('clients')
        .select('*, cases:cases(*)')
        .eq('client_code', clientCode)
        .single();
      if (err) throw new Error(err.message);
      return row as ClientRow & { cases: CaseRow[] };
    },
    enabled: !!clientCode,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: ClientInsert) => {
      const { data, error: err } = await supabase
        .from('clients')
        .insert(input)
        .select()
        .single();
      if (err) throw new Error(err.message);
      return data as ClientRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const create = useCallback(async (input: ClientInsert) => {
    try {
      return await mutateAsync(input);
    } catch {
      return null;
    }
  }, [mutateAsync]);

  return { create, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Defenses Catalog
// ============================================================
export function useDefenses() {
  const { data, error, isLoading } = useQuery<DefenseCatalogRow[]>({
    queryKey: ['defenses_catalog'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('defenses_catalog')
        .select('*')
        .order('code', { ascending: true });
      if (err) throw new Error(err.message);
      return rows as DefenseCatalogRow[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// ============================================================
// Legal Deadlines Reference
// ============================================================
export function useLegalDeadlines() {
  const { data, error, isLoading } = useQuery<LegalDeadlineRow[]>({
    queryKey: ['legal_deadlines_reference'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('legal_deadlines_reference')
        .select('*')
        .order('code', { ascending: true });
      if (err) throw new Error(err.message);
      return rows as LegalDeadlineRow[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// ============================================================
// Procedural Stages
// ============================================================
export function useProceduralStage(caseId: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['procedural_stages', caseId],
    queryFn: async () => {
      const { data: row, error: err } = await supabase
        .from('procedural_stages')
        .select('*')
        .eq('case_id', caseId)
        .single();
      if (err) throw new Error(err.message);
      return row as ProceduralStageRow;
    },
    enabled: !!caseId,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// ============================================================
// Attachments
// ============================================================
export function useAllAttachments() {
  const { data, error, isLoading } = useQuery<AttachmentWithCase[]>({
    queryKey: ['attachments'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('attachments')
        .select('*, case:cases(case_code)')
        .order('uploaded_at', { ascending: false });
      if (err) throw new Error(err.message);
      return rows as AttachmentWithCase[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// ============================================================
// Schedule / Hearings
// ============================================================
export function useUpcomingHearings() {
  const { data, error, isLoading } = useQuery<ScheduleWithCase[]>({
    queryKey: ['schedule', 'upcoming'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: rows, error: err } = await supabase
        .from('schedule')
        .select('*, case:cases(case_code, court_name, client:clients(full_name))')
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .limit(20);
      if (err) throw new Error(err.message);
      return rows as ScheduleWithCase[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useAllSchedules() {
  const { data, error, isLoading } = useQuery<ScheduleWithCase[]>({
    queryKey: ['schedule', 'all'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('schedule')
        .select('*, case:cases(case_code, court_name, client:clients(full_name))')
        .order('session_date', { ascending: true });
      if (err) throw new Error(err.message);
      return rows as ScheduleWithCase[];
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateHearing() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: ScheduleInsert) => {
      const { data, error: err } = await supabase
        .from('schedule')
        .insert(input)
        .select()
        .single();
      if (err) throw new Error(err.message);
      return data as ScheduleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const create = useCallback(async (input: ScheduleInsert) => {
    try {
      return await mutateAsync(input);
    } catch {
      return null;
    }
  }, [mutateAsync]);

  return { create, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Dashboard aggregates
// ============================================================
export function useDashboardStats() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      const in3 = new Date();
      in3.setDate(in3.getDate() + 3);
      const in7Str = in7.toISOString().split('T')[0];
      const in3Str = in3.toISOString().split('T')[0];

      const [casesRes, clientsRes, upcomingRes, urgentRes] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('schedule').select('id').gte('session_date', today).lte('session_date', in7Str),
        supabase.from('schedule').select('id').gte('session_date', today).lte('session_date', in3Str),
      ]);

      return {
        totalCases: casesRes.count ?? 0,
        totalClients: clientsRes.count ?? 0,
        upcomingCount: upcomingRes.data?.length ?? 0,
        urgentCount: urgentRes.data?.length ?? 0,
      };
    },
    refetchInterval: 60_000, // Refetch every 60s for live dashboard
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// Aliases for convenience
export const useAllClients = useClients;
export const useAllCases = useCases;
