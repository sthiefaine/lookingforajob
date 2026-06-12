import { createStore } from "zustand";
import type { OfferStatus, Source } from "@prisma/client";

export interface OfferDTO {
  id: string;
  source: Source;
  title: string;
  url: string;
  description: string | null;
  location: string | null;
  category: string | null;
  contractType: string | null;
  deadline: string | null;
  publishedAt: string | null;
  status: OfferStatus;
  isActive: boolean;
  firstSeenAt: string;
}

export type SortKey = "recent" | "deadline" | "title";

export interface OffersState {
  offers: OfferDTO[];
  search: string;
  sources: Source[];
  statuses: OfferStatus[];
  sort: SortKey;
  showInactive: boolean;
  setSearch: (s: string) => void;
  toggleSource: (s: Source) => void;
  toggleStatus: (s: OfferStatus) => void;
  setSort: (s: SortKey) => void;
  setShowInactive: (v: boolean) => void;
  setStatus: (id: string, status: OfferStatus) => Promise<void>;
}

export type OffersStore = ReturnType<typeof createOffersStore>;

/** One store per request/page so SSR renders with the fetched offers. */
export function createOffersStore(initialOffers: OfferDTO[]) {
  return createStore<OffersState>()((set, get) => ({
    offers: initialOffers,
    search: "",
    sources: [],
    statuses: [],
    sort: "recent",
    showInactive: false,
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
  }));
}

export interface VisibleFilters {
  offers: OfferDTO[];
  search: string;
  sources: Source[];
  statuses: OfferStatus[];
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
    if (
      q &&
      ![o.title, o.location, o.category, o.contractType, o.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    )
      return false;
    return true;
  });
  switch (f.sort) {
    case "deadline":
      return list.sort((a, b) =>
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
      );
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    default:
      return list.sort((a, b) => {
        const da = a.publishedAt ?? a.firstSeenAt;
        const db = b.publishedAt ?? b.firstSeenAt;
        return db.localeCompare(da);
      });
  }
}
