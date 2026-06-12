import { prisma } from "@/lib/prisma";
import { notifyNewOffers } from "@/lib/notify";
import { educationGouvScraper } from "./educationGouv";
import { heidelbergScraper } from "./heidelberg";
import { montp3Scraper } from "./montp3";
import type { Scraper } from "./types";
import type { JobOffer, Prisma } from "@prisma/client";

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
    const newOffers: JobOffer[] = [];
    const now = new Date();

    for (const o of offers) {
      const existing = await prisma.jobOffer.findUnique({
        where: {
          source_externalId: { source: scraper.source, externalId: o.externalId },
        },
        select: { id: true },
      });
      const data = {
        title: o.title,
        url: o.url,
        description: o.description,
        location: o.location,
        category: o.category,
        contractType: o.contractType,
        deadline: o.deadline,
        publishedAt: o.publishedAt,
        raw: (o.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: true,
        lastSeenAt: now,
      };
      if (existing) {
        await prisma.jobOffer.update({ where: { id: existing.id }, data });
      } else {
        const created = await prisma.jobOffer.create({
          data: { ...data, source: scraper.source, externalId: o.externalId },
        });
        newOffers.push(created);
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
        added: newOffers.length,
      },
    });

    if (newOffers.length > 0) {
      await notifyNewOffers(newOffers).catch((e) =>
        console.error("[notify] failed:", e)
      );
    }

    return {
      source: scraper.source,
      ok: true,
      found: offers.length,
      added: newOffers.length,
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
