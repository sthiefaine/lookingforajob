import * as cheerio from "cheerio";
import type { JobOffer } from "@prisma/client";
import { FETCH_HEADERS } from "@/lib/scrapers/types";

/** Convert scraped/Salesforce HTML to readable plain text (no markup kept,
 *  so nothing untrusted ever reaches the DOM). */
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h\d|tr|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return cheerio
    .load(`<div>${withBreaks}</div>`)("div")
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EDU_SECTIONS: [string, string][] = [
  ["DescriptionPoste__c", "Description du poste"],
  ["DescriptifProfilRecherche__c", "Profil recherché"],
  ["DescriptifEmployeur__c", "Employeur"],
  ["ConditionsParticulieresExercice__c", "Conditions particulières"],
  ["InformationsComplementaires__c", "Informations complémentaires"],
];

async function fetchEducationGouvDetails(offer: JobOffer): Promise<string | null> {
  const res = await fetch(
    `https://recrutement.education.gouv.fr/recrutement/webruntime/api/services/data/v66.0/ui-api/records/${offer.externalId}?layoutTypes=Full&modes=View&language=fr&asGuest=true&htmlEncode=false`,
    { headers: FETCH_HEADERS }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    fields?: Record<string, { value?: unknown }>;
  };
  const parts: string[] = [];
  for (const [field, label] of EDU_SECTIONS) {
    const value = data.fields?.[field]?.value;
    if (typeof value === "string" && value.trim()) {
      parts.push(`${label.toUpperCase()}\n\n${htmlToText(value)}`);
    }
  }
  return parts.length ? parts.join("\n\n———\n\n") : null;
}

async function fetchMontp3Details(offer: JobOffer): Promise<string | null> {
  const res = await fetch(offer.url, { headers: FETCH_HEADERS });
  if (!res.ok) return null;
  const $ = cheerio.load(await res.text());
  const root = $("#offre").length ? $("#offre") : $("#page-details-offre");
  if (!root.length) return null;
  root.find("script, style, nav, form, button").remove();
  const text = htmlToText(root.html() ?? "");
  return text.length > 80 ? text : null;
}

async function fetchHeidelbergDetails(offer: JobOffer): Promise<string | null> {
  const res = await fetch(offer.url, { headers: FETCH_HEADERS });
  if (!res.ok) return null;
  const $ = cheerio.load(await res.text());
  const root = $("#awpcpadpage, .awpcpadpage").first();
  if (!root.length) return null;
  root
    .find("script, style, nav, form, button, .awpcp-classifieds-menu, .awpcp-classifieds-search-bar")
    .remove();
  const text = htmlToText(root.html() ?? "");
  return text.length > 40 ? text : null;
}

/** Fetch the full offer text from the source site. Returns null when the
 *  source has nothing usable; throws only on unexpected errors. */
export async function fetchOfferDetails(offer: JobOffer): Promise<string | null> {
  switch (offer.source) {
    case "EDUCATION_GOUV":
      return fetchEducationGouvDetails(offer);
    case "UNIV_MONTP3":
      return fetchMontp3Details(offer);
    case "HEIDELBERG":
      return fetchHeidelbergDetails(offer);
  }
}
