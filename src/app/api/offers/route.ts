import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLastRunAt, toDTO, OFFERS_ORDER } from "@/lib/offers";

export const dynamic = "force-dynamic";

/** Full (slim) offers list — fetched by the client after first paint and
 *  re-polled periodically so fresh scrapes show up without a reload. */
export async function GET() {
  const [rows, lastRunAt] = await Promise.all([
    prisma.jobOffer.findMany({
      orderBy: [...OFFERS_ORDER],
    }),
    getLastRunAt(),
  ]);
  return NextResponse.json({
    offers: rows.map(toDTO),
    lastRunAt,
  });
}
