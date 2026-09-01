// ============================================================
// CRIM-SYS 2026 — Global UI State (Zustand)
// Manages sidebar, modals, search, notifications, and toasts
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---- Sidebar State ----

interface SidebarState {
  collapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (v) => set({ collapsed: v }),
    }),
    { name: "crimsys-sidebar" }
  )
);

// ---- Modal / Dialog State ----

export type ModalId =
  | "new-case"
  | "new-client"
  | "new-hearing"
  | "confirm-delete"
  | "case-details"
  | "export-pdf"
  | "ocr-scan"
  | "entity-links"
  | null;

interface ModalState {
  activeModal: ModalId;
  modalPayload: Record<string, unknown>;
  openModal: (id: ModalId, payload?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>()((set) => ({
  activeModal: null,
  modalPayload: {},
  openModal: (id, payload = {}) => set({ activeModal: id, modalPayload: payload }),
  closeModal: () => set({ activeModal: null, modalPayload: {} }),
}));

// ---- Global Search State ----

interface SearchState {
  query: string;
  isOpen: boolean;
  setQuery: (q: string) => void;
  setOpen: (v: boolean) => void;
  close: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: "",
  isOpen: false,
  setQuery: (q) => set({ query: q, isOpen: q.length >= 2 }),
  setOpen: (v) => set({ isOpen: v }),
  close: () => set({ query: "", isOpen: false }),
}));

// ---- Notification Panel State ----

interface NotificationState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen, _profileOpen: false })),
  close: () => set({ isOpen: false }),
  _profileOpen: false,
}));

// ---- Profile Dropdown State ----

interface ProfileState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
}));

// ---- Toast / Command Palette State (for future use) ----

interface CommandPaletteState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useCommandPalette = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
