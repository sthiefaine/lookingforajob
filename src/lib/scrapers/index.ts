import { prisma } from "@/lib/prisma";
import { notifyNewOffers } from "@/lib/notify";
import { educationGouvScraper } from "./educationGouv";
import { heidelbergScraper } from "./heidelberg";
import { montp3Scraper } from "./montp3";
import type { Scraper } from "./types";
import type { Prisma } from "@prisma/client";

export const scrapers: Scraper[] = [
  educationGouvScraper,
  montp3Scraper,
  heidelbergScraper,
];

export interface ScrapeSummary {
  source: string;
  ok: boolean;
  found: number;
  added: number;
  error?: string;
}

async function runOne(scraper: Scraper): Promise<ScrapeSummary> {
  const run = await prisma.scrapeRun.create({
    data: { source: scraper.source },
  });
  try {
    const offers = await scraper.scrape();
    const now = new Date();

    // Batched sync: a handful of queries per run instead of one per offer.
    const existing = await prisma.jobOffer.findMany({
      where: { source: scraper.source },
      select: {
        externalId: true,
        title: true,
        url: true,
        deadline: true,
        isActive: true,
      },
    });
    const byExternalId = new Map(existing.map((e) => [e.externalId, e]));

    const fresh = offers.filter((o) => !byExternalId.has(o.externalId));
    if (fresh.length > 0) {
      await prisma.jobOffer.createMany({
        data: fresh.map((o) => ({
          source: scraper.source,
          externalId: o.externalId,
          title: o.title,
          url: o.url,
          description: o.description,
          location: o.location,
          category: o.category,
          contractType: o.contractType,
          deadline: o.deadline,
          publishedAt: o.publishedAt,
          raw: (o.raw ?? undefined) as Prisma.InputJsonValue | undefined,
          lastSeenAt: now,
        })),
        skipDuplicates: true,
      });
    }

    // Refresh lastSeenAt / reactivate everything still listed (one query).
    const seenIds = offers.map((o) => o.externalId);
    if (seenIds.length > 0) {
      await prisma.jobOffer.updateMany({
        where: { source: scraper.source, externalId: { in: seenIds } },
        data: { lastSeenAt: now, isActive: true },
      });
    }

    // Per-offer updates only when something meaningful actually changed.
    for (const o of offers) {
      const prev = byExternalId.get(o.externalId);
      if (
        prev &&
        (prev.title !== o.title ||
          prev.url !== o.url ||
          (prev.deadline?.getTime() ?? null) !== (o.deadline?.getTime() ?? null))
      ) {
        await prisma.jobOffer.update({
          where: {
            source_externalId: {
              source: scraper.source,
              externalId: o.externalId,
            },
          },
          data: { title: o.title, url: o.url, deadline: o.deadline },
        });
      }
    }

    // Offers that disappeared from an exhaustive listing are closed.
    if (scraper.exhaustive && offers.length > 0) {
      await prisma.jobOffer.updateMany({
        where: {
          source: scraper.source,
          isActive: true,
          lastSeenAt: { lt: now },
        },
        data: { isActive: false },
      });
    }

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: true,
        found: offers.length,
        added: fresh.length,
      },
    });

    if (fresh.length > 0) {
      const created = await prisma.jobOffer.findMany({
        where: {
          source: scraper.source,
          externalId: { in: fresh.map((o) => o.externalId) },
        },
      });
      await notifyNewOffers(created).catch((e) =>
        console.error("[notify] failed:", e)
      );
    }

    return {
      source: scraper.source,
      ok: true,
      found: offers.length,
      added: fresh.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: message },
    });
    return { source: scraper.source, ok: false, found: 0, added: 0, error: message };
  }
}

let running = false;

/** Run every scraper; serialized so overlapping cron ticks don't pile up. */
export async function scrapeAll(): Promise<ScrapeSummary[]> {
  if (running) return [];
  running = true;
  try {
    return await Promise.all(scrapers.map(runOne));
  } finally {
    running = false;
  }
}
