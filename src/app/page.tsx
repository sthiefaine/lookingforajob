import { prisma } from "@/lib/prisma";
import { OffersApp } from "@/components/OffersApp";
import type { OfferDTO } from "@/store/offers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await prisma.jobOffer.findMany({
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
  });

  const offers: OfferDTO[] = rows.map((o) => ({
    id: o.id,
    source: o.source,
    title: o.title,
    url: o.url,
    description: o.description,
    location: o.location,
    category: o.category,
    contractType: o.contractType,
    deadline: o.deadline?.toISOString() ?? null,
    publishedAt: o.publishedAt?.toISOString() ?? null,
    status: o.status,
    isActive: o.isActive,
    firstSeenAt: o.firstSeenAt.toISOString(),
  }));

  const lastRun = await prisma.scrapeRun.findFirst({
    where: { ok: true },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });

  return (
    <OffersApp
      initialOffers={offers}
      lastRunAt={lastRun?.finishedAt?.toISOString() ?? null}
    />
  );
}
