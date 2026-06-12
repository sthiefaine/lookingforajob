import { prisma } from "@/lib/prisma";
import type { JobOffer } from "@prisma/client";
import type { OfferDTO } from "@/store/offers";

export function toDTO(o: JobOffer): OfferDTO {
  return {
    id: o.id,
    source: o.source,
    title: o.title,
    url: o.url,
    description: o.description ? o.description.slice(0, 220) : null,
    location: o.location,
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
  { publishedAt: "desc" },
  { firstSeenAt: "desc" },
] as const;

export async function getLastRunAt(): Promise<string | null> {
  const lastRun = await prisma.scrapeRun.findFirst({
    where: { ok: true },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  return lastRun?.finishedAt?.toISOString() ?? null;
}
