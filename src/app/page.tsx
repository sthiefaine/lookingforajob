import { prisma } from "@/lib/prisma";
import { OffersApp } from "@/components/OffersApp";
import { getLastRunAt, toDTO, OFFERS_ORDER } from "@/lib/offers";

export const dynamic = "force-dynamic";

const SSR_COUNT = 50;

export default async function Home() {
  const [rows, total, lastRunAt] = await Promise.all([
    prisma.jobOffer.findMany({
      where: { isActive: true },
      orderBy: [...OFFERS_ORDER],
      take: SSR_COUNT,
    }),
    prisma.jobOffer.count(),
    getLastRunAt(),
  ]);

  return (
    <OffersApp
      initialOffers={rows.map(toDTO)}
      totalCount={total}
      lastRunAt={lastRunAt}
    />
  );
}
