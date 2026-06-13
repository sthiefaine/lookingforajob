import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Mark every NEW offer as SEEN (reset the "non consultées" counter). */
export async function POST() {
  const { count } = await prisma.jobOffer.updateMany({
    where: { status: "NEW" },
    data: { status: "SEEN" },
  });
  return NextResponse.json({ count });
}
