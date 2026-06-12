import type { Source } from "@prisma/client";

export interface ScrapedOffer {
  externalId: string;
  title: string;
  url: string;
  description?: string;
  location?: string;
  category?: string;
  contractType?: string;
  deadline?: Date;
  publishedAt?: Date;
  raw?: unknown;
}

export interface Scraper {
  source: Source;
  /** True when the scraper returns the complete list of currently-open
   *  offers, allowing missing ones to be marked inactive. */
  exhaustive: boolean;
  scrape: () => Promise<ScrapedOffer[]>;
}

const MONTHS_FR: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

/** Parse a French date like "26 juin 2026" found anywhere in the text. */
export function parseFrenchDate(text: string): Date | undefined {
  const m = text
    .toLowerCase()
    .match(/(\d{1,2})(?:er)?\s+([a-zéûô]+)\s+(\d{4})/);
  if (!m) return undefined;
  const month = MONTHS_FR[m[2]];
  if (month === undefined) return undefined;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]), 12));
}

export const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};
