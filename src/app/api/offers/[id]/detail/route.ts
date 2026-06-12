import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchOfferDetails } from "@/lib/details";

export const dynamic = "force-dynamic";

/** Lazy detail loader: fetched from the source site on first request,
 *  then cached in the database. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const offer = await prisma.jobOffer.findUnique({ where: { id } });
  if (!offer) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (offer.details) {
    return NextResponse.json({ details: offer.details });
  }

  let details: string | null = null;
  try {
    details = await fetchOfferDetails(offer);
  } catch (e) {
    console.error(`[detail] fetch failed for ${offer.id}:`, e);
  }
  if (details) {
    await prisma.jobOffer.update({ where: { id }, data: { details } });
  }
  return NextResponse.json({ details });
}
