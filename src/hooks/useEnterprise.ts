// ============================================================
// CRIM-SYS Enterprise — React Query Hooks
// All server state managed through TanStack Query.
// ============================================================

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/enterprise/service";
import type {
  PersonRow,
  PersonInsert,
  CaseInsert,
  SessionRow,
  SessionInsert,
  DocumentRow,
  DocumentInsert,
  ActionRow,
  ActionInsert,
  DashboardStats,
  CaseWithPerson,
  CaseWithAll,
  PersonWithCases,
} from "@/types/enterprise";

// ============================================================
// Persons Hooks
// ============================================================

export function usePersons() {
  const { data, error, isLoading } = useQuery<PersonRow[]>({
    queryKey: ["enterprise", "persons"],
    queryFn: service.fetchPersons,
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function usePerson(personCode: string) {
  const { data, error, isLoading } = useQuery<PersonWithCases>({
    queryKey: ["enterprise", "persons", personCode],
    queryFn: () => service.fetchPerson(personCode),
    enabled: !!personCode,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreatePerson() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: PersonInsert) => service.createPerson(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "persons"] }),
  });

  const create = useCallback(
    async (input: PersonInsert) => {
      try {
        return await mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { create, loading: isPending, error: error?.message ?? null };
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PersonInsert> }) =>
      service.updatePerson(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "persons"] }),
  });

  const update = useCallback(
    async (id: string, input: Partial<PersonInsert>) => {
      try {
        return await mutateAsync({ id, input });
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { update, loading: isPending, error: error?.message ?? null };
}

export function useDeletePerson() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (id: string) => service.deletePerson(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "persons"] }),
  });

  const remove = useCallback(
    async (id: string) => {
      try {
        await mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync],
  );

  return { remove, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Cases Hooks
// ============================================================

export function useCases() {
  const { data, error, isLoading } = useQuery<CaseWithPerson[]>({
    queryKey: ["enterprise", "cases"],
    queryFn: service.fetchCases,
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCase(caseCode: string) {
  const { data, error, isLoading } = useQuery<CaseWithAll>({
    queryKey: ["enterprise", "cases", caseCode],
    queryFn: () => service.fetchCase(caseCode),
    enabled: !!caseCode,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateCase() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: CaseInsert) => service.createCase(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "cases"] }),
  });

  const create = useCallback(
    async (input: CaseInsert) => {
      try {
        return await mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { create, loading: isPending, error: error?.message ?? null };
}

export function useUpdateCase() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CaseInsert> }) =>
      service.updateCase(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "cases"] }),
  });

  const update = useCallback(
    async (id: string, input: Partial<CaseInsert>) => {
      try {
        return await mutateAsync({ id, input });
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { update, loading: isPending, error: error?.message ?? null };
}

export function useDeleteCase() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (id: string) => service.deleteCase(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "cases"] }),
  });

  const remove = useCallback(
    async (id: string) => {
      try {
        await mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync],
  );

  return { remove, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Sessions Hooks
// ============================================================

export function useSessions(caseId?: string) {
  const { data, error, isLoading } = useQuery<SessionRow[]>({
    queryKey: ["enterprise", "sessions", caseId ?? "all"],
    queryFn: () => service.fetchSessions(caseId),
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useUpcomingSessions() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["enterprise", "sessions", "upcoming"],
    queryFn: service.fetchUpcomingSessions,
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateSession() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: SessionInsert) => service.createSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "sessions"] }),
  });

  const create = useCallback(
    async (input: SessionInsert) => {
      try {
        return await mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { create, loading: isPending, error: error?.message ?? null };
}

export function useUpdateSession() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SessionInsert> }) =>
      service.updateSession(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "sessions"] }),
  });

  const update = useCallback(
    async (id: string, input: Partial<SessionInsert>) => {
      try {
        return await mutateAsync({ id, input });
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { update, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Documents Hooks
// ============================================================

export function useDocuments(caseId?: string) {
  const { data, error, isLoading } = useQuery<DocumentRow[]>({
    queryKey: ["enterprise", "documents", caseId ?? "all"],
    queryFn: () => service.fetchDocuments(caseId),
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateDocument() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: DocumentInsert) => service.createDocument(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "documents"] }),
  });

  const create = useCallback(
    async (input: DocumentInsert) => {
      try {
        return await mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { create, loading: isPending, error: error?.message ?? null };
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DocumentInsert> }) =>
      service.updateDocument(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "documents"] }),
  });

  const update = useCallback(
    async (id: string, input: Partial<DocumentInsert>) => {
      try {
        return await mutateAsync({ id, input });
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { update, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Actions Hooks
// ============================================================

export function useActions(caseId?: string) {
  const { data, error, isLoading } = useQuery<ActionRow[]>({
    queryKey: ["enterprise", "actions", caseId ?? "all"],
    queryFn: () => service.fetchActions(caseId),
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useOverdueActions() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["enterprise", "actions", "overdue"],
    queryFn: service.fetchOverdueActions,
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

export function useCreateAction() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: (input: ActionInsert) => service.createAction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "actions"] }),
  });

  const create = useCallback(
    async (input: ActionInsert) => {
      try {
        return await mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { create, loading: isPending, error: error?.message ?? null };
}

export function useUpdateAction() {
  const qc = useQueryClient();
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ActionInsert> }) =>
      service.updateAction(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise", "actions"] }),
  });

  const update = useCallback(
    async (id: string, input: Partial<ActionInsert>) => {
      try {
        return await mutateAsync({ id, input });
      } catch {
        return null;
      }
    },
    [mutateAsync],
  );

  return { update, loading: isPending, error: error?.message ?? null };
}

// ============================================================
// Dashboard Stats
// ============================================================

export function useDashboardStats() {
  const { data, error, isLoading } = useQuery<DashboardStats>({
    queryKey: ["enterprise", "dashboard"],
    queryFn: service.fetchDashboardStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}

// ============================================================
// Audit Log
// ============================================================

export function useAuditLog(entityType?: string, entityId?: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["enterprise", "audit", entityType, entityId],
    queryFn: () => service.fetchAuditLog(entityType, entityId),
    staleTime: 10_000,
  });
  return { data: data ?? null, error: error?.message ?? null, loading: isLoading };
}
