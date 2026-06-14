export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_CRON === "false") return;

  const cron = (await import("node-cron")).default;
  const { scrapeAll } = await import("@/lib/scrapers");
  const { syncTelegramSubscribers, setTelegramCommands } = await import(
    "@/lib/telegram"
  );

  // Register the Telegram command menu once at boot.
  setTelegramCommands().catch(() => {});

  // Scrape every 2 minutes.
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

  // Pick up /start, /stop, /help every minute so new subscribers onboard fast.
  cron.schedule("* * * * *", async () => {
    try {
      const { added, removed } = await syncTelegramSubscribers();
      if (added || removed) {
        console.log(`[telegram] +${added} subscriber(s), -${removed}`);
      }
    } catch (e) {
      console.error("[telegram] sync failed:", e);
    }
  });

  console.log("[cron] scraping every 2 min, Telegram sync every 1 min");
}
