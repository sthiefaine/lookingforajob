import { prisma } from "@/lib/prisma";
import type { JobOffer } from "@prisma/client";
import type { OfferDTO } from "@/store/offers";
import { departementLabel } from "@/lib/departements";

/** Normalized department label ("Hérault (34)") for filtering, per source. */
function deptOf(o: JobOffer): string | null {
  switch (o.source) {
    case "UNIV_MONTP3":
      // Université Paul-Valéry — Montpellier
      return departementLabel("34");
    case "HEIDELBERG": {
      const loc = o.location ?? "";
      const postal = loc.match(/\b(\d{5})\b/);
      if (postal) {
        const code = postal[1].startsWith("97")
          ? postal[1].slice(0, 3)
          : postal[1].slice(0, 2);
        return departementLabel(code);
      }
      if (/montpellier|castelnau|lattes|grabels|juvignac|p[ée]rols/i.test(loc)) {
        return departementLabel("34");
      }
      return null;
    }
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
    dept: deptOf(o),
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
