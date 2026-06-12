import { type Scraper, type ScrapedOffer, FETCH_HEADERS } from "./types";

/**
 * recrutement.education.gouv.fr is a Salesforce Experience Cloud (LWR) site.
 * The offer list is served by the open-source sfpegList Apex controller,
 * reachable as a guest — no auth needed. One POST returns every offer
 * matching the filters (the on-page pagination is purely client-side).
 */
const API_URL =
  "https://recrutement.education.gouv.fr/recrutement/webruntime/api/apex/execute?language=fr&asGuest=true&htmlEncode=false";
const APEX_CLASS = "@udd/01pIV000000aXE1"; // sfpegList_CTL
const LIST_CONFIG = "SearchOffresVirtuo";

/** Region__c codes (INSEE région) — default mirrors the user's saved search. */
const REGIONS =
  process.env.EDUCATION_GOUV_REGIONS ??
  "84;27;53;24;94;44;32;11;28;75;76;52;93";

interface EduOffer {
  Id: string;
  Name: string;
  Acad__c?: string;
  Categorie__c?: string;
  Departement__c?: string;
  DomaineFonctionnel__c?: string;
  EmployeurNameFormula__c?: string;
  FonctionFiliere__c?: string;
  NatureContrat__c?: string;
  NiveauEtudes__c?: string;
  PublicationDateDebutParDefaut__c?: string;
  Region__c?: string;
  TempsTravail__c?: string;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const educationGouvScraper: Scraper = {
  source: "EDUCATION_GOUV",
  exhaustive: true,
  async scrape(): Promise<ScrapedOffer[]> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json",
        Referer: "https://recrutement.education.gouv.fr/recrutement/offres",
      },
      body: JSON.stringify({
        namespace: "",
        classname: APEX_CLASS,
        method: "getData",
        isContinuation: false,
        params: {
          name: LIST_CONFIG,
          input: {
            TERM: "",
            ACD: "",
            DF: "",
            NE: "",
            REG: REGIONS,
            DPT: "",
            CAT: "",
            FNC: "",
            NAT: "",
            POP: "",
          },
        },
        cacheable: false,
      }),
    });
    if (!res.ok) throw new Error(`education.gouv API HTTP ${res.status}`);
    const data = (await res.json()) as { returnValue?: EduOffer[] };
    if (!Array.isArray(data.returnValue)) {
      throw new Error("education.gouv API: unexpected payload shape");
    }

    return data.returnValue.map((o): ScrapedOffer => {
      const published = o.PublicationDateDebutParDefaut__c
        ? new Date(`${o.PublicationDateDebutParDefaut__c}T12:00:00Z`)
        : undefined;
      const locParts = [
        o.Acad__c && `Académie : ${o.Acad__c}`,
        o.Departement__c && `Dépt ${o.Departement__c}`,
      ].filter(Boolean);
      return {
        externalId: o.Id,
        title: o.Name,
        url: `https://recrutement.education.gouv.fr/recrutement/offreemploi/${o.Id}/${slugify(o.Name)}`,
        description: o.EmployeurNameFormula__c,
        location: locParts.join(" — ") || undefined,
        category: o.DomaineFonctionnel__c,
        contractType:
          [o.NatureContrat__c, o.TempsTravail__c].filter(Boolean).join(" · ") ||
          undefined,
        publishedAt: published,
        raw: o,
      };
    });
  },
};
