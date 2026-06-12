"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { OfferStatus, Source } from "@prisma/client";
import {
  computeVisibleOffers,
  createOffersStore,
  type OfferDTO,
  type OffersState,
  type OffersStore,
  type SortKey,
} from "@/store/offers";

const StoreCtx = createContext<OffersStore | null>(null);

function useOffers<T>(selector: (s: OffersState) => T): T {
  const store = useContext(StoreCtx);
  if (!store) throw new Error("OffersApp store missing");
  return useStore(store, selector);
}

const SOURCE_META: Record<Source, { label: string; badge: string }> = {
  EDUCATION_GOUV: { label: "Éduc. nationale", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  UNIV_MONTP3: { label: "Montpellier 3", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  HEIDELBERG: { label: "M. Heidelberg", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

const STATUS_META: Record<OfferStatus, { label: string; icon: string; cls: string }> = {
  NEW: { label: "Nouveau", icon: "✨", cls: "text-emerald-300" },
  SEEN: { label: "Vu", icon: "👁", cls: "text-zinc-400" },
  INTERESTED: { label: "Intéressé", icon: "⭐", cls: "text-yellow-300" },
  APPLIED: { label: "Postulé", icon: "✉️", cls: "text-sky-300" },
  REJECTED: { label: "Écarté", icon: "✕", cls: "text-zinc-500" },
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Récentes" },
  { key: "deadline", label: "Deadline" },
  { key: "title", label: "A→Z" },
];

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function OffersApp({
  initialOffers,
  lastRunAt,
}: {
  initialOffers: OfferDTO[];
  lastRunAt: string | null;
}) {
  const storeRef = useRef<OffersStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createOffersStore(initialOffers);
  }
  return (
    <StoreCtx.Provider value={storeRef.current}>
      <OffersScreen lastRunAt={lastRunAt} />
    </StoreCtx.Provider>
  );
}

function OffersScreen({ lastRunAt }: { lastRunAt: string | null }) {
  const offers = useOffers((s) => s.offers);
  const search = useOffers((s) => s.search);
  const sources = useOffers((s) => s.sources);
  const statuses = useOffers((s) => s.statuses);
  const sort = useOffers((s) => s.sort);
  const showInactive = useOffers((s) => s.showInactive);
  const setSearch = useOffers((s) => s.setSearch);
  const toggleSource = useOffers((s) => s.toggleSource);
  const toggleStatus = useOffers((s) => s.toggleStatus);
  const setSort = useOffers((s) => s.setSort);
  const setShowInactive = useOffers((s) => s.setShowInactive);

  const visible = useMemo(
    () =>
      computeVisibleOffers({ offers, search, sources, statuses, sort, showInactive }),
    [offers, search, sources, statuses, sort, showInactive]
  );

  const newCount = useMemo(
    () => offers.filter((o) => o.status === "NEW" && o.isActive).length,
    [offers]
  );

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              🎯 Offres d&apos;emploi
            </h1>
            <span className="text-xs text-zinc-500">
              {lastRunAt
                ? `MAJ ${new Date(lastRunAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "jamais scanné"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {visible.length} affichée{visible.length > 1 ? "s" : ""}
            {newCount > 0 && (
              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                {newCount} nouvelle{newCount > 1 ? "s" : ""}
              </span>
            )}
          </p>

          <input
            type="search"
            placeholder="Rechercher un poste, un lieu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />

          {/* Filter chips — horizontal scroll on mobile */}
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {(Object.keys(SOURCE_META) as Source[]).map((s) => (
              <Chip key={s} active={sources.includes(s)} onClick={() => toggleSource(s)}>
                {SOURCE_META[s].label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-zinc-800" />
            {(Object.keys(STATUS_META) as OfferStatus[]).map((s) => (
              <Chip key={s} active={statuses.includes(s)} onClick={() => toggleStatus(s)}>
                {STATUS_META[s].icon} {STATUS_META[s].label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-zinc-800" />
            {SORTS.map((s) => (
              <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
                ↕ {s.label}
              </Chip>
            ))}
            <Chip active={showInactive} onClick={() => setShowInactive(!showInactive)}>
              Inclure fermées
            </Chip>
          </div>
        </div>
      </header>

      {/* List */}
      <main className="mx-auto max-w-3xl px-4 py-3">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Aucune offre — le scraper tourne toutes les 2 minutes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visible.slice(0, 300).map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </ul>
        )}
        {visible.length > 300 && (
          <p className="py-4 text-center text-xs text-zinc-500">
            {visible.length - 300} offres de plus — affine les filtres pour les voir.
          </p>
        )}
      </main>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-zinc-300 bg-zinc-100 font-medium text-zinc-900"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 active:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function OfferCard({ offer }: { offer: OfferDTO }) {
  const setStatus = useOffers((s) => s.setStatus);
  const sourceMeta = SOURCE_META[offer.source];
  const deadline = fmtDate(offer.deadline);
  const published = fmtDate(offer.publishedAt) ?? fmtDate(offer.firstSeenAt);

  return (
    <li
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 ${
        offer.status === "REJECTED" ? "opacity-50" : ""
      } ${!offer.isActive ? "border-dashed opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => offer.status === "NEW" && setStatus(offer.id, "SEEN")}
          className="text-sm font-semibold leading-snug text-zinc-100 underline-offset-2 active:underline"
        >
          {offer.title}
        </a>
        {offer.status === "NEW" && offer.isActive && (
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 ${sourceMeta.badge}`}>
          {sourceMeta.label}
        </span>
        {offer.location && (
          <span className="text-zinc-400">📍 {offer.location}</span>
        )}
        {offer.contractType && (
          <span className="text-zinc-400">📄 {offer.contractType}</span>
        )}
        {published && <span className="text-zinc-500">🗓 {published}</span>}
        {deadline && (
          <span className="font-medium text-orange-300">⏳ {deadline}</span>
        )}
        {!offer.isActive && <span className="text-zinc-500">— fermée</span>}
      </div>

      {offer.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
          {offer.description}
        </p>
      )}

      <div className="mt-2.5 flex gap-1.5">
        {(["SEEN", "INTERESTED", "APPLIED", "REJECTED"] as OfferStatus[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatus(offer.id, offer.status === s ? "SEEN" : s)}
              className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] transition-colors ${
                offer.status === s
                  ? "border-zinc-400 bg-zinc-800 font-semibold " +
                    STATUS_META[s].cls
                  : "border-zinc-800 text-zinc-500 active:bg-zinc-800"
              }`}
            >
              {STATUS_META[s].icon} {STATUS_META[s].label}
            </button>
          )
        )}
      </div>
    </li>
  );
}
