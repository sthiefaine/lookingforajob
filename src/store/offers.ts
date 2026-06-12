import { create } from "zustand";
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

interface OffersState {
  offers: OfferDTO[];
  search: string;
  sources: Source[];
  statuses: OfferStatus[];
  sort: SortKey;
  showInactive: boolean;
  setOffers: (offers: OfferDTO[]) => void;
  setSearch: (s: string) => void;
  toggleSource: (s: Source) => void;
  toggleStatus: (s: OfferStatus) => void;
  setSort: (s: SortKey) => void;
  setShowInactive: (v: boolean) => void;
  setStatus: (id: string, status: OfferStatus) => Promise<void>;
}

export const useOffersStore = create<OffersState>((set, get) => ({
  offers: [],
  search: "",
  sources: [],
  statuses: [],
  sort: "recent",
  showInactive: false,
  setOffers: (offers) => set({ offers }),
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
    set({
      offers: prev.map((o) => (o.id === id ? { ...o, status } : o)),
    });
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) set({ offers: prev });
  },
}));

export function selectVisibleOffers(st: OffersState): OfferDTO[] {
  const q = st.search.trim().toLowerCase();
  let list = st.offers.filter((o) => {
    if (!st.showInactive && !o.isActive) return false;
    if (st.sources.length && !st.sources.includes(o.source)) return false;
    if (st.statuses.length && !st.statuses.includes(o.status)) return false;
    if (
      q &&
      ![o.title, o.location, o.category, o.contractType, o.description]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    )
      return false;
    return true;
  });
  switch (st.sort) {
    case "deadline":
      list = [...list].sort((a, b) =>
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
      );
      break;
    case "title":
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, "fr"));
      break;
    default:
      list = [...list].sort((a, b) => {
        const da = a.publishedAt ?? a.firstSeenAt;
        const db = b.publishedAt ?? b.firstSeenAt;
        return db.localeCompare(da);
      });
  }
  return list;
}
