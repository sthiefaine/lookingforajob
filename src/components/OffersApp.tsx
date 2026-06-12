"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/* ---------- icons (lucide outlines, inline to avoid a dependency) ---------- */

function SvgIcon({
  children,
  className = "h-3.5 w-3.5",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IconMapPin = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </SvgIcon>
);

const IconBriefcase = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </SvgIcon>
);

const IconClock = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </SvgIcon>
);

const IconExternal = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </SvgIcon>
);

const IconSearch = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </SvgIcon>
);

const IconChevronDown = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

/* ---------------------------- metadata tables ----------------------------- */

const SOURCE_META: Record<Source, { label: string; dot: string; text: string }> =
  {
    EDUCATION_GOUV: {
      label: "Éducation nationale",
      dot: "bg-sky-400",
      text: "text-sky-300",
    },
    UNIV_MONTP3: {
      label: "Univ. Montpellier 3",
      dot: "bg-violet-400",
      text: "text-violet-300",
    },
    HEIDELBERG: {
      label: "Maison de Heidelberg",
      dot: "bg-amber-400",
      text: "text-amber-300",
    },
  };

const STATUS_META: Record<
  OfferStatus,
  { label: string; active: string }
> = {
  NEW: { label: "Nouveau", active: "" },
  SEEN: {
    label: "Vu",
    active: "border-zinc-500 bg-zinc-800 text-zinc-200",
  },
  INTERESTED: {
    label: "Intéressé",
    active: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  },
  APPLIED: {
    label: "Postulé",
    active: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  },
  REJECTED: {
    label: "Écarté",
    active: "border-zinc-600 bg-zinc-800/80 text-zinc-500",
  },
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Dernières entrées" },
  { key: "published", label: "Date de publication" },
  { key: "deadline", label: "Date limite" },
  { key: "title", label: "Ordre alphabétique" },
];

/* ----------------------------- date formatting ---------------------------- */

// Deterministic date formatting — node:alpine ships a minimal ICU, so
// Intl/toLocale* renders differently on the server than in the browser and
// breaks hydration. Never use Intl in SSR'd text here.
const MONTHS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]}`;
}

/* --------------------------------- shell ---------------------------------- */

const REFRESH_MS = 60_000;

export function OffersApp({
  initialOffers,
  totalCount,
  lastRunAt,
}: {
  initialOffers: OfferDTO[];
  totalCount: number;
  lastRunAt: string | null;
}) {
  const storeRef = useRef<OffersStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createOffersStore(initialOffers, lastRunAt);
  }

  // Restore persisted filter preferences after mount (deferred so the SSR
  // markup stays deterministic), then fetch the full list and keep it fresh.
  useEffect(() => {
    const store = storeRef.current!;
    store.persist.rehydrate();
    let cancelled = false;

    const refresh = async (force = false) => {
      if (!force && document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/offers");
        if (!res.ok) return;
        const data = (await res.json()) as {
          offers: OfferDTO[];
          lastRunAt: string | null;
        };
        if (!cancelled) store.getState().replaceAll(data.offers, data.lastRunAt);
      } catch {
        // transient network error — next tick will retry
      }
    };

    refresh(true);
    const interval = setInterval(() => refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <StoreCtx.Provider value={storeRef.current}>
      <OffersScreen totalCount={totalCount} />
    </StoreCtx.Provider>
  );
}

/* --------------------------------- screen --------------------------------- */

function OffersScreen({ totalCount }: { totalCount: number }) {
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const offers = useOffers((s) => s.offers);
  const lastRunAt = useOffers((s) => s.lastRunAt);
  const fullyLoaded = useOffers((s) => s.fullyLoaded);
  const search = useOffers((s) => s.search);
  const sources = useOffers((s) => s.sources);
  const statuses = useOffers((s) => s.statuses);
  const depts = useOffers((s) => s.depts);
  const sort = useOffers((s) => s.sort);
  const showInactive = useOffers((s) => s.showInactive);
  const setSearch = useOffers((s) => s.setSearch);
  const toggleSource = useOffers((s) => s.toggleSource);
  const toggleStatus = useOffers((s) => s.toggleStatus);
  const toggleDept = useOffers((s) => s.toggleDept);
  const clearDepts = useOffers((s) => s.clearDepts);
  const setSort = useOffers((s) => s.setSort);
  const setShowInactive = useOffers((s) => s.setShowInactive);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visible = useMemo(
    () =>
      computeVisibleOffers({
        offers,
        search,
        sources,
        statuses,
        depts,
        sort,
        showInactive,
      }),
    [offers, search, sources, statuses, depts, sort, showInactive]
  );

  const deptOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of offers) {
      if (!o.dept || (!o.isActive && !showInactive)) continue;
      counts.set(o.dept, (counts.get(o.dept) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")
    );
  }, [offers, showInactive]);

  const newCount = useMemo(
    () => offers.filter((o) => o.status === "NEW" && o.isActive).length,
    [offers]
  );

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Offres d&apos;emploi
            </h1>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {mounted && lastRunAt
                ? `Actualisé à ${new Date(lastRunAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-zinc-500">
            <span className="font-medium text-zinc-300 tabular-nums">
              {visible.length}
            </span>{" "}
            sur {totalCount}
            {!fullyLoaded && totalCount > offers.length && " · chargement…"}
            {newCount > 0 && (
              <span className="ml-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-px text-[11px] font-medium text-emerald-300">
                {newCount} non consultée{newCount > 1 ? "s" : ""}
              </span>
            )}
          </p>

          {/* search */}
          <div className="relative mt-3">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Poste, ville, mot-clé…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {/* departments + sort */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <DeptPicker
              depts={depts}
              options={deptOptions}
              toggle={toggleDept}
              clear={clearDepts}
            />
            <label className="relative block">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="w-full appearance-none truncate rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-3 pr-8 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </label>
          </div>

          {/* filter chips */}
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <button
              onClick={() => toggleDept(MONTPELLIER_DEPT)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                depts.includes(MONTPELLIER_DEPT)
                  ? "border-sky-400/60 bg-sky-500/15 text-sky-300"
                  : "border-sky-500/30 bg-zinc-900 text-sky-400/90 hover:border-sky-400/50 active:bg-zinc-800"
              }`}
            >
              <IconMapPin className="h-3 w-3" />
              Montpellier (34)
            </button>
            <span className="mx-1 w-px shrink-0 self-stretch bg-zinc-800" />
            {(Object.keys(SOURCE_META) as Source[]).map((s) => (
              <Chip
                key={s}
                active={sources.includes(s)}
                onClick={() => toggleSource(s)}
              >
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${SOURCE_META[s].dot}`}
                />
                {SOURCE_META[s].label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-zinc-800" />
            {(["NEW", "SEEN", "INTERESTED", "APPLIED", "REJECTED"] as OfferStatus[]).map(
              (s) => (
                <Chip
                  key={s}
                  active={statuses.includes(s)}
                  onClick={() => toggleStatus(s)}
                >
                  {STATUS_META[s].label}
                </Chip>
              )
            )}
            <span className="mx-1 w-px shrink-0 self-stretch bg-zinc-800" />
            <Chip
              active={showInactive}
              onClick={() => setShowInactive(!showInactive)}
            >
              Offres fermées
            </Chip>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {visible.length === 0 ? (
          <p className="py-20 text-center text-sm text-zinc-500">
            Aucune offre ne correspond à ces critères.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.slice(0, 200).map((o) => (
              <OfferCard key={o.id} offer={o} onOpen={() => setOpenOfferId(o.id)} />
            ))}
          </ul>
        )}
        {visible.length > 200 && (
          <p className="py-5 text-center text-xs text-zinc-500">
            {visible.length - 200} offres supplémentaires — affinez les filtres
            pour les afficher.
          </p>
        )}
      </main>

      {openOfferId && (
        <DetailSheetById id={openOfferId} onClose={() => setOpenOfferId(null)} />
      )}
    </div>
  );
}

/* ------------------------------ detail sheet ------------------------------ */

const detailCache = new Map<string, string | null>();

/** Reads the live offer from the store so status changes reflect instantly. */
function DetailSheetById({ id, onClose }: { id: string; onClose: () => void }) {
  const offer = useOffers((s) => s.offers.find((o) => o.id === id));
  if (!offer) return null;
  return <DetailSheet offer={offer} onClose={onClose} />;
}

function DetailSheet({
  offer,
  onClose,
}: {
  offer: OfferDTO;
  onClose: () => void;
}) {
  const setStatus = useOffers((s) => s.setStatus);
  const meta = SOURCE_META[offer.source];
  const [details, setDetails] = useState<string | null | undefined>(
    detailCache.has(offer.id) ? detailCache.get(offer.id) : undefined
  );

  useEffect(() => {
    if (offer.status === "NEW") setStatus(offer.id, "SEEN");
    if (detailCache.has(offer.id)) return;
    let cancelled = false;
    fetch(`/api/offers/${offer.id}/detail`)
      .then((r) => (r.ok ? r.json() : { details: null }))
      .then((d: { details: string | null }) => {
        detailCache.set(offer.id, d.details);
        if (!cancelled) setDetails(d.details);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-700/60 bg-zinc-900 shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4 pb-3">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${meta.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug text-zinc-50">
              {offer.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {(offer.dept ?? offer.location) && (
                <span className="inline-flex items-center gap-1">
                  <IconMapPin className="h-3.5 w-3.5 text-zinc-500" />
                  {offer.source === "EDUCATION_GOUV"
                    ? (offer.dept ?? offer.location)
                    : (offer.location ?? offer.dept)}
                </span>
              )}
              {offer.contractType && (
                <span className="inline-flex items-center gap-1">
                  <IconBriefcase className="h-3.5 w-3.5 text-zinc-500" />
                  {offer.contractType}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800"
          >
            <SvgIcon className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </SvgIcon>
          </button>
        </div>

        {/* body */}
        <div className="min-h-32 flex-1 overflow-y-auto p-4">
          {details === undefined ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Chargement du détail…
            </p>
          ) : details === null ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Détail indisponible — ouvre l&apos;annonce d&apos;origine.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-zinc-300">
              {details}
            </pre>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="flex gap-1">
            {(["SEEN", "INTERESTED", "APPLIED", "REJECTED"] as OfferStatus[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() =>
                    setStatus(offer.id, offer.status === s ? "SEEN" : s)
                  }
                  className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                    offer.status === s
                      ? STATUS_META[s].active
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700 active:bg-zinc-800"
                  }`}
                >
                  {STATUS_META[s].label}
                </button>
              )
            )}
          </div>
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25"
          >
            Voir l&apos;annonce
            <IconExternal className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ dept picker ------------------------------- */

const MONTPELLIER_DEPT = "Hérault (34)";

function DeptPicker({
  depts,
  options,
  toggle,
  clear,
}: {
  depts: string[];
  options: [string, number][];
  toggle: (d: string) => void;
  clear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const label =
    depts.length === 0
      ? "Tous les départements"
      : depts.length === 1
        ? depts[0]
        : `${depts.length} départements`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-zinc-900 py-2 pl-3 pr-2.5 text-sm focus:outline-none ${
          depts.length > 0
            ? "border-sky-500/50 text-sky-300"
            : "border-zinc-800 text-zinc-300 focus:border-zinc-500"
        }`}
      >
        <span className="truncate">{label}</span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl shadow-black/60">
          {depts.length > 0 && (
            <button
              onClick={clear}
              className="mb-1 w-full rounded-md border border-zinc-700 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Tout désélectionner ({depts.length})
            </button>
          )}
          {options.map(([d, n]) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={depts.includes(d)}
                onChange={() => toggle(d)}
                className="h-3.5 w-3.5 accent-sky-500"
              />
              <span className="flex-1 truncate">{d}</span>
              <span className="text-xs tabular-nums text-zinc-500">{n}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-zinc-500">
              Aucun département disponible
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- chip ---------------------------------- */

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
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-zinc-400 bg-zinc-100 font-medium text-zinc-900"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 active:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- card ---------------------------------- */

function OfferCard({
  offer,
  onOpen,
}: {
  offer: OfferDTO;
  onOpen: () => void;
}) {
  const setStatus = useOffers((s) => s.setStatus);
  const meta = SOURCE_META[offer.source];
  const deadline = fmtDate(offer.deadline);
  const added = fmtDate(offer.firstSeenAt);
  const published = fmtDate(offer.publishedAt);

  return (
    <li
      className={`rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4 transition-colors ${
        offer.status === "REJECTED" ? "opacity-55" : ""
      } ${!offer.isActive ? "border-dashed opacity-65" : ""}`}
    >
      {/* source + new badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${meta.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {offer.status === "NEW" && offer.isActive && (
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Nouveau
          </span>
        )}
        {!offer.isActive && (
          <span className="rounded-full border border-zinc-700 px-2 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Fermée
          </span>
        )}
      </div>

      {/* title — opens the in-app detail sheet */}
      <button
        onClick={onOpen}
        className="mt-1.5 block w-full text-left text-[15px] font-semibold leading-snug text-zinc-50 hover:text-white hover:underline underline-offset-2"
      >
        {offer.title}
      </button>

      {/* meta */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        {(offer.dept ?? offer.location) && (
          <span className="inline-flex items-center gap-1">
            <IconMapPin className="h-3.5 w-3.5 text-zinc-500" />
            {offer.source === "EDUCATION_GOUV"
              ? (offer.dept ?? offer.location)
              : (offer.location ?? offer.dept)}
          </span>
        )}
        {offer.contractType && (
          <span className="inline-flex items-center gap-1">
            <IconBriefcase className="h-3.5 w-3.5 text-zinc-500" />
            {offer.contractType}
          </span>
        )}
        {deadline ? (
          <span className="inline-flex items-center gap-1 font-medium text-orange-300/90">
            <IconClock className="h-3.5 w-3.5" />
            Jusqu&apos;au {deadline}
          </span>
        ) : (
          (published ?? added) && (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <IconClock className="h-3.5 w-3.5" />
              {published ? `Publiée le ${published}` : `Ajoutée le ${added}`}
            </span>
          )
        )}
      </div>

      {/* description */}
      {offer.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
          {offer.description}
        </p>
      )}

      {/* actions */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-3">
        <div className="flex gap-1">
          {(["SEEN", "INTERESTED", "APPLIED", "REJECTED"] as OfferStatus[]).map(
            (s) => (
              <button
                key={s}
                onClick={() =>
                  setStatus(offer.id, offer.status === s ? "SEEN" : s)
                }
                className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  offer.status === s
                    ? STATUS_META[s].active
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 active:bg-zinc-800"
                }`}
              >
                {STATUS_META[s].label}
              </button>
            )
          )}
        </div>
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => offer.status === "NEW" && setStatus(offer.id, "SEEN")}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          Voir l&apos;annonce
          <IconExternal className="h-3.5 w-3.5" />
        </a>
      </div>
    </li>
  );
}
