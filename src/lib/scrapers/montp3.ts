import * as cheerio from "cheerio";
import { FETCH_HEADERS, parseFrenchDate, type Scraper, type ScrapedOffer } from "./types";

const LISTING_URL = "https://www.univ-montp3.fr/fr/offres-emplois";

/**
 * The Montpellier 3 page is a flat sequence of <h4>Title</h4> followed by
 * <p> detail lines, the last of which links to the ATS
 * (offres-emplois.univ-montp3.fr/candidat/offre/<id>).
 */
export const montp3Scraper: Scraper = {
  source: "UNIV_MONTP3",
  exhaustive: true,
  async scrape(): Promise<ScrapedOffer[]> {
    const res = await fetch(LISTING_URL, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`montp3 listing HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());

    const offers: ScrapedOffer[] = [];
    $("a[href*='offres-emplois.univ-montp3.fr/candidat/offre/']").each(
      (_, el) => {
        const a = $(el);
        const url = a.attr("href")!;
        const externalId = url.match(/offre\/(\d+)/)?.[1];
        if (!externalId) return;

        // Walk back from the link's <p> to the owning <h4>, collecting
        // the detail paragraphs in between.
        const details: string[] = [];
        let title = "";
        let node = a.closest("p");
        let cur = node.length ? node.prev() : a.prev();
        while (cur.length) {
          const text = cur.text().replace(/\s+/g, " ").trim();
          if (cur.is("h4")) {
            if (text) {
              title = text;
              break;
            }
          } else if (cur.is("p") && text) {
            details.unshift(text);
          }
          cur = cur.prev();
        }
        if (!title) return;

        const linkText = a.text().trim();
        const deadline = parseFrenchDate(linkText);
        const description = details.join("\n") || undefined;
        const contractType = details
          .find((d) => /CDD|CDI|titulaire|contractuel/i.test(d));

        offers.push({
          externalId,
          title,
          url,
          description,
          contractType,
          deadline,
          location: "Montpellier",
          category: "Université Paul-Valéry Montpellier 3",
        });
      }
    );

    // The page can link the same offer twice; keep the first occurrence.
    const seen = new Set<string>();
    return offers.filter((o) =>
      seen.has(o.externalId) ? false : (seen.add(o.externalId), true)
    );
  },
};
