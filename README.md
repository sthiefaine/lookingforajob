# lookingforajob

Agrégateur d'offres d'emploi mobile-first. Scrape plusieurs sources toutes les 2 minutes, stocke en PostgreSQL, et permet de trier/suivre les offres (vu / intéressé / postulé / écarté).

## Sources

| Source | Méthode | Détail |
|---|---|---|
| [recrutement.education.gouv.fr](https://recrutement.education.gouv.fr/recrutement/offres) | API JSON (Salesforce sfpegList, accès guest) | filtrée par régions via `EDUCATION_GOUV_REGIONS` |
| [univ-montp3.fr](https://www.univ-montp3.fr/fr/offres-emplois) | Scraping HTML (cheerio) | liste complète rendue côté serveur |
| [maison-de-heidelberg.org](https://maison-de-heidelberg.org/nos-services/petites-annonces/parcourir-les-annonces/) | Scraping HTML (cheerio) | annonces catégorie `emploi-stage` |

## Stack

- **Next.js 16** (App Router, standalone) + **Tailwind 4**
- **Zustand** — état client (filtres, tri, statuts optimistes)
- **Prisma 6** + PostgreSQL
- **node-cron** dans `instrumentation.ts` — scrape toutes les 2 min dans le process Next
- Notifications **Telegram** (optionnel, voir `.env.example`)

## Dev

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL
npx prisma migrate deploy && npx prisma generate
npm run dev
```

`POST /api/scrape` déclenche un scrape manuel. `npx tsx scripts/test-scrapers.ts` teste les scrapers sans DB.

## Déploiement

Dockerfile multi-stage (standalone) ; `prisma migrate deploy` s'exécute au démarrage du conteneur. Déployé via Coolify.
