import * as cheerio from "cheerio";
import { FETCH_HEADERS, type Scraper, type ScrapedOffer } from "./types";

const LISTING_URL =
  "https://maison-de-heidelberg.org/nos-services/petites-annonces/parcourir-les-annonces/";

/**
 * Maison de Heidelberg (Montpellier) posts its classifieds — including job
 * offers — through the AWPCP WordPress plugin. Ad URLs look like
 * /affichage-de-lannonce/<id>/<slug>/<place>/<category>/ ; we keep only the
 * "emploi-stage" category.
 */
export const heidelbergScraper: Scraper = {
  source: "HEIDELBERG",
  exhaustive: true,
  async scrape(): Promise<ScrapedOffer[]> {
    const res = await fetch(LISTING_URL, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`heidelberg listing HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());

    const offers = new Map<string, ScrapedOffer>();
    $("a[href*='/affichage-de-lannonce/']").each((_, el) => {
      const a = $(el);
      const url = a.attr("href");
      if (!url || !/\/emploi-stage\/?$/.test(url)) return;
      const m = url.match(/affichage-de-lannonce\/(\d+)\/([^/]+)\/([^/]+)\//);
      if (!m) return;
      const [, externalId, , placeSlug] = m;
      const title = a.text().replace(/\s+/g, " ").trim();
      const existing = offers.get(externalId);
      if (existing && !existing.title && title) existing.title = title;
      if (existing) return;
      offers.set(externalId, {
        externalId,
        title,
        url,
        location: decodeURIComponent(placeSlug).replace(/-/g, " "),
        category: "Maison de Heidelberg — emploi/stage",
      });
    });

    return [...offers.values()].filter((o) => o.title);
  },
};
