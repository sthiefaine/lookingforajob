import { prisma } from "@/lib/prisma";
import type { JobOffer } from "@prisma/client";
import type { OfferDTO } from "@/store/offers";
import { departementLabel } from "@/lib/departements";

function capitalizeWords(s: string): string {
  return s.replace(/\p{L}+/gu, (w) => w[0].toUpperCase() + w.slice(1));
}

/** Best-effort normalized "city" for filtering, per source. */
function cityOf(o: JobOffer): string | null {
  switch (o.source) {
    case "UNIV_MONTP3":
      return "Montpellier";
    case "HEIDELBERG":
      return o.location ? capitalizeWords(o.location.toLowerCase()) : null;
    case "EDUCATION_GOUV": {
      const raw = o.raw as { Departement__c?: string } | null;
      if (raw?.Departement__c) {
        const label = departementLabel(raw.Departement__c);
        if (label) return label;
      }
      return null;
    }
  }
}

export function toDTO(o: JobOffer): OfferDTO {
  return {
    id: o.id,
    source: o.source,
    title: o.title,
    url: o.url,
    description: o.description ? o.description.slice(0, 220) : null,
    location: o.location,
    city: cityOf(o),
    category: o.category,
    contractType: o.contractType,
    deadline: o.deadline?.toISOString() ?? null,
    publishedAt: o.publishedAt?.toISOString() ?? null,
    status: o.status,
    isActive: o.isActive,
    firstSeenAt: o.firstSeenAt.toISOString(),
  };
}

export const OFFERS_ORDER = [
  { firstSeenAt: "desc" },
  { publishedAt: "desc" },
] as const;

export async function getLastRunAt(): Promise<string | null> {
  const lastRun = await prisma.scrapeRun.findFirst({
    where: { ok: true },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  return lastRun?.finishedAt?.toISOString() ?? null;
}
