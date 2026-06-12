import { educationGouvScraper } from "../src/lib/scrapers/educationGouv";
import { heidelbergScraper } from "../src/lib/scrapers/heidelberg";
import { montp3Scraper } from "../src/lib/scrapers/montp3";

async function main() {
  for (const s of [educationGouvScraper, montp3Scraper, heidelbergScraper]) {
    const offers = await s.scrape();
    console.log(`\n=== ${s.source}: ${offers.length} offers ===`);
    for (const o of offers.slice(0, 2)) {
      console.log(JSON.stringify({ ...o, raw: undefined }, null, 1).slice(0, 500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
