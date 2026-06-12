import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OfferStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !(status in OfferStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const offer = await prisma.jobOffer.update({
    where: { id },
    data: { status: status as OfferStatus },
  });
  return NextResponse.json({ offer });
}
