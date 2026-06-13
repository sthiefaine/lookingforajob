import { createStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OfferStatus, Source } from "@prisma/client";

export interface OfferDTO {
  id: string;
  source: Source;
  title: string;
  url: string;
  description: string | null;
  location: string | null;
  dept: string | null;
  category: string | null;
  contractType: string | null;
  deadline: string | null;
  publishedAt: string | null;
  status: OfferStatus;
  isActive: boolean;
  firstSeenAt: string;
}

export type SortKey = "recent" | "published" | "deadline" | "title";

export interface OffersState {
  offers: OfferDTO[];
  /** False until the full list has been fetched client-side. */
  fullyLoaded: boolean;
  lastRunAt: string | null;
  search: string;
  sources: Source[];
  statuses: OfferStatus[];
  depts: string[];
  sort: SortKey;
  showInactive: boolean;
  replaceAll: (offers: OfferDTO[], lastRunAt: string | null) => void;
  setSearch: (s: string) => void;
  toggleSource: (s: Source) => void;
  toggleStatus: (s: OfferStatus) => void;
  toggleDept: (d: string) => void;
  clearDepts: () => void;
  setSort: (s: SortKey) => void;
  setShowInactive: (v: boolean) => void;
  setStatus: (id: string, status: OfferStatus) => Promise<void>;
  markAllSeen: () => Promise<void>;
}

export type OffersStore = ReturnType<typeof createOffersStore>;

/** One store per request/page so SSR renders with the fetched offers.
 *  Filter preferences persist to localStorage; rehydration is deferred
 *  (skipHydration) and triggered after mount to keep SSR markup stable. */
export function createOffersStore(
  initialOffers: OfferDTO[],
  lastRunAt: string | null
) {
  return createStore<OffersState>()(
    persist(
      (set, get) => ({
        offers: initialOffers,
        fullyLoaded: false,
        lastRunAt,
        search: "",
        sources: [],
        statuses: [],
        depts: [],
        sort: "recent" as SortKey,
        showInactive: false,
        replaceAll: (offers, newLastRunAt) =>
          set({ offers, lastRunAt: newLastRunAt, fullyLoaded: true }),
        setSearch: (search) => set({ search }),
        toggleSource: (s) =>
          set((st) => ({
            sources: st.sources.includes(s)
              ? st.sources.filter((x) => x !== s)
              : [...st.sources, s],
          })),
        toggleStatus: (s) =>
          set((st) => ({
            statuses: st.statuses.includes(s)
              ? st.statuses.filter((x) => x !== s)
              : [...st.statuses, s],
          })),
        toggleDept: (d) =>
          set((st) => ({
            depts: st.depts.includes(d)
              ? st.depts.filter((x) => x !== d)
              : [...st.depts, d],
          })),
        clearDepts: () => set({ depts: [] }),
        setSort: (sort) => set({ sort }),
        setShowInactive: (showInactive) => set({ showInactive }),
        setStatus: async (id, status) => {
          const prev = get().offers;
          set({ offers: prev.map((o) => (o.id === id ? { ...o, status } : o)) });
          const res = await fetch(`/api/offers/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          if (!res.ok) set({ offers: prev });
        },
        markAllSeen: async () => {
          const prev = get().offers;
          set({
            offers: prev.map((o) =>
              o.status === "NEW" ? { ...o, status: "SEEN" } : o
            ),
          });
          const res = await fetch("/api/offers/seen-all", { method: "POST" });
          if (!res.ok) set({ offers: prev });
        },
      }),
      {
        name: "lfaj-filters",
        version: 1,
        storage: createJSONStorage(() => localStorage),
        skipHydration: true,
        partialize: (s) => ({
          sources: s.sources,
          statuses: s.statuses,
          depts: s.depts,
          sort: s.sort,
          showInactive: s.showInactive,
        }),
      }
    )
  );
}

export interface VisibleFilters {
  offers: OfferDTO[];
  search: string;
  sources: Source[];
  statuses: OfferStatus[];
  depts: string[];
  sort: SortKey;
  showInactive: boolean;
}

/** Pure helper — call from useMemo, never as a store selector. */
export function computeVisibleOffers(f: VisibleFilters): OfferDTO[] {
  const q = f.search.trim().toLowerCase();
  const list = f.offers.filter((o) => {
    if (!f.showInactive && !o.isActive) return false;
    if (f.sources.length && !f.sources.includes(o.source)) return false;
    if (f.statuses.length && !f.statuses.includes(o.status)) return false;
    if (f.depts.length && (!o.dept || !f.depts.includes(o.dept))) return false;
    if (
      q &&
      ![o.title, o.dept, o.location, o.category, o.contractType, o.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    )
      return false;
    return true;
  });
  switch (f.sort) {
    case "published":
      return list.sort((a, b) => {
        const da = a.publishedAt ?? a.firstSeenAt;
        const db = b.publishedAt ?? b.firstSeenAt;
        return db.localeCompare(da);
      });
    case "deadline":
      return list.sort((a, b) =>
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
      );
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    default:
      // "recent" — newest discoveries first
      return list.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  }
}
