import { NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scrapers";

export const dynamic = "force-dynamic";

export async function POST() {
  const summaries = await scrapeAll();
  return NextResponse.json({ summaries });
}

export async function GET() {
  return POST();
}
