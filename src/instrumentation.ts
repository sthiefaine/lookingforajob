export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_CRON === "false") return;

  const cron = (await import("node-cron")).default;
  const { scrapeAll } = await import("@/lib/scrapers");

  cron.schedule("*/2 * * * *", async () => {
    try {
      const summaries = await scrapeAll();
      if (summaries.length > 0) {
        console.log(
          "[cron]",
          summaries
            .map((s) =>
              s.ok
                ? `${s.source}: ${s.found} found, ${s.added} new`
                : `${s.source}: ERROR ${s.error}`
            )
            .join(" | ")
        );
      }
    } catch (e) {
      console.error("[cron] scrape failed:", e);
    }
  });
  console.log("[cron] scraping every 2 minutes");
}
