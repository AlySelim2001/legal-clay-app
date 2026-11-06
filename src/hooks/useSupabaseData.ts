import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { sanitizeForLocalStorage } from '@/lib/sanitize';
import {
  mockCases,
  mockClients,
  mockHearings,
  mockDeadlines,
  mockDefenses,
} from '@/data/mock';
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

// Helper mock data converters
const fallbackCases: CaseWithClient[] = mockCases.map((c) => ({
  id: c.id,
  case_code: c.caseCode,
  case_number: c.caseCode.replace(/[^0-9]/g, '') || '847',
  case_year: 2026,
  court_name: c.court,
  crime_type: c.crimeType,
  client_id: c.clientCode,
  priority: c.priority,
  status: c.status,
  notes: c.notes,
  defense_id: null,
  procedural_stage_id: null,
  created_at: `${c.filingDate}T00:00:00.000Z`,
  updated_at: new Date().toISOString(),
  client: {
    id: c.clientCode,
    client_code: c.clientCode,
    full_name: c.clientName,
    national_id_display: '28503120104523',
    phone: '01001234567',
    email: 'client@example.com',
    address: 'القاهرة، مصر',
    created_at: new Date().toISOString(),
  },
}));

const fallbackClients: ClientRow[] = mockClients.map((c) => ({
  id: c.id,
  client_code: c.clientCode,
  full_name: c.name,
  national_id_display: c.nationalId,
  phone: c.phone,
  email: c.email,
  address: c.address,
  created_at: `${c.joinDate}T00:00:00.000Z`,
}));

const fallbackSchedules: ScheduleWithCase[] = mockHearings.map((h) => ({
  id: h.id,
  case_id: h.caseCode,
  session_date: h.date,
  session_time: h.time,
  session_type: h.type,
  notes: h.notes,
  judge_name: h.judge,
  created_at: new Date().toISOString(),
  case: {
    case_code: h.caseCode,
    court_name: h.court,
    client: { full_name: 'أحمد إبراهيم' },
  },
}));

const fallbackDefenses: DefenseCatalogRow[] = mockDefenses.map((d) => ({
  id: d.id,
  code: d.code,
  name: d.title,
  description: d.description,
  legal_basis: d.legalBasis,
  category: d.category,
  precedent: d.precedent,
  created_at: new Date().toISOString(),
}));

const fallbackDeadlines: LegalDeadlineRow[] = mockDeadlines.map((d, i) => ({
  id: `${i + 1}`,
  code: d.caseCode,
  rule_name: d.type,
  deadline_days: 15,
  legal_basis: d.description,
  court_type: 'جنايات',
  created_at: new Date().toISOString(),
}));

// ============================================================
// Cases
// ============================================================
export function useCases() {
  const { data, error, isLoading } = useQuery<CaseWithClient[]>({
    queryKey: ['cases'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return fallbackCases;
      try {
        const { data: rows, error: err } = await supabase
          .from('cases')
          .select('*, client:clients(*)')
          .order('updated_at', { ascending: false });
        if (err) throw new Error(err.message);
        return rows as CaseWithClient[];
      } catch (err) {
        console.warn('[CRIM-SYS] useCases falling back to mock:', err);
        return fallbackCases;
      }
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCase(caseCode: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['cases', caseCode],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const found = fallbackCases.find((c) => c.case_code === caseCode) || fallbackCases[0];
        return {
          ...found,
          defense: fallbackDefenses[0] || null,
          procedural_stage: null,
          schedules: fallbackSchedules.filter((s) => s.case?.case_code === caseCode),
          attachments: [],
        };
      }
      try {
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
      } catch (err) {
        console.warn('[CRIM-SYS] useCase falling back to mock:', err);
        const found = fallbackCases.find((c) => c.case_code === caseCode) || fallbackCases[0];
        return {
          ...found,
          defense: fallbackDefenses[0] || null,
          procedural_stage: null,
          schedules: fallbackSchedules.filter((s) => s.case?.case_code === caseCode),
          attachments: [],
        };
      }
    },
    enabled: !!caseCode,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: CaseInsert) => {
      if (!isSupabaseConfigured) {
        const newCase: CaseRow = {
          ...input,
          id: String(Date.now()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackCases.unshift({
          ...newCase,
          client: null,
        });
        return newCase;
      }
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
      if (!isSupabaseConfigured) return fallbackClients;
      try {
        const { data: rows, error: err } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        if (err) throw new Error(err.message);
        return sanitizeForLocalStorage(rows as ClientRow[]);
      } catch (err) {
        console.warn('[CRIM-SYS] useClients falling back to mock:', err);
        return fallbackClients;
      }
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useClient(clientCode: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['clients', clientCode],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const found = fallbackClients.find((c) => c.client_code === clientCode) || fallbackClients[0];
        return {
          ...found,
          cases: fallbackCases.filter((c) => c.client_id === found.id || c.client_id === found.client_code),
        };
      }
      try {
        const { data: row, error: err } = await supabase
          .from('clients')
          .select('*, cases:cases(*)')
          .eq('client_code', clientCode)
          .single();
        if (err) throw new Error(err.message);
        return sanitizeForLocalStorage(row as ClientRow & { cases: CaseRow[] });
      } catch (err) {
        console.warn('[CRIM-SYS] useClient falling back to mock:', err);
        const found = fallbackClients.find((c) => c.client_code === clientCode) || fallbackClients[0];
        return {
          ...found,
          cases: fallbackCases.filter((c) => c.client_id === found.id || c.client_id === found.client_code),
        };
      }
    },
    enabled: !!clientCode,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: ClientInsert) => {
      if (!isSupabaseConfigured) {
        const newClient: ClientRow = {
          ...input,
          id: String(Date.now()),
          created_at: new Date().toISOString(),
        };
        fallbackClients.unshift(newClient);
        return newClient;
      }
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
      if (!isSupabaseConfigured) return fallbackDefenses;
      try {
        const { data: rows, error: err } = await supabase
          .from('defenses_catalog')
          .select('*')
          .order('code', { ascending: true });
        if (err) throw new Error(err.message);
        return rows as DefenseCatalogRow[];
      } catch {
        return fallbackDefenses;
      }
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
      if (!isSupabaseConfigured) return fallbackDeadlines;
      try {
        const { data: rows, error: err } = await supabase
          .from('legal_deadlines_reference')
          .select('*')
          .order('code', { ascending: true });
        if (err) throw new Error(err.message);
        return rows as LegalDeadlineRow[];
      } catch {
        return fallbackDeadlines;
      }
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
      if (!isSupabaseConfigured) return null;
      try {
        const { data: row, error: err } = await supabase
          .from('procedural_stages')
          .select('*')
          .eq('case_id', caseId)
          .single();
        if (err) return null;
        return row as ProceduralStageRow;
      } catch {
        return null;
      }
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
      if (!isSupabaseConfigured) return [];
      try {
        const { data: rows, error: err } = await supabase
          .from('attachments')
          .select('*, case:cases(case_code)')
          .order('uploaded_at', { ascending: false });
        if (err) return [];
        return rows as AttachmentWithCase[];
      } catch {
        return [];
      }
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
      if (!isSupabaseConfigured) return fallbackSchedules;
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: rows, error: err } = await supabase
          .from('schedule')
          .select('*, case:cases(case_code, court_name, client:clients(full_name))')
          .gte('session_date', today)
          .order('session_date', { ascending: true })
          .limit(20);
        if (err) throw new Error(err.message);
        return rows as ScheduleWithCase[];
      } catch {
        return fallbackSchedules;
      }
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useAllSchedules() {
  const { data, error, isLoading } = useQuery<ScheduleWithCase[]>({
    queryKey: ['schedule', 'all'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return fallbackSchedules;
      try {
        const { data: rows, error: err } = await supabase
          .from('schedule')
          .select('*, case:cases(case_code, court_name, client:clients(full_name))')
          .order('session_date', { ascending: true });
        if (err) throw new Error(err.message);
        return rows as ScheduleWithCase[];
      } catch {
        return fallbackSchedules;
      }
    },
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateHearing() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (input: ScheduleInsert) => {
      if (!isSupabaseConfigured) {
        const newSched: ScheduleRow = {
          ...input,
          id: String(Date.now()),
          created_at: new Date().toISOString(),
        };
        fallbackSchedules.unshift({
          ...newSched,
          case: { case_code: input.case_id, court_name: 'محكمة الجنايات', client: null },
        });
        return newSched;
      }
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
      if (!isSupabaseConfigured) {
        return {
          totalCases: fallbackCases.length,
          totalClients: fallbackClients.length,
          upcomingCount: fallbackSchedules.length,
          urgentCount: 3,
        };
      }
      try {
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
          totalCases: casesRes.count ?? fallbackCases.length,
          totalClients: clientsRes.count ?? fallbackClients.length,
          upcomingCount: upcomingRes.data?.length ?? fallbackSchedules.length,
          urgentCount: urgentRes.data?.length ?? 3,
        };
      } catch {
        return {
          totalCases: fallbackCases.length,
          totalClients: fallbackClients.length,
          upcomingCount: fallbackSchedules.length,
          urgentCount: 3,
        };
      }
    },
    refetchInterval: 60_000,
  });

  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// Aliases for convenience
export const useAllClients = useClients;
export const useAllCases = useCases;
