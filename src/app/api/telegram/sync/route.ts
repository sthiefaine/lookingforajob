import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTelegramSubscribers } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Manually trigger a Telegram update poll (handles /start, /stop, /help)
 *  and report current subscriber count. */
export async function POST() {
  const result = await syncTelegramSubscribers();
  const count = await prisma.telegramSubscriber.count({
    where: { active: true },
  });
  return NextResponse.json({ ...result, activeSubscribers: count });
}

export async function GET() {
  return POST();
}
